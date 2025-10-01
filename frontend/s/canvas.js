'use strict';

// Low-level canvas handler. Positions are based on the upper-left pixel.
const LLCanvas = new class {
	_SetCanvas(NewX, NewY, NewZoom, Instant) {
		let TransformString = `scale(${NewZoom}) translate(${-NewX}px, ${-NewY}px)`;
		this._C.style.transform = TransformString;
		this._C.style.transitionDuration = Instant ? '0s' : '500ms';

		this._X = NewX;
		this._Y = NewY;
		this._Zoom = NewZoom;
	}

	get Width() { return this._C.offsetWidth; }
	get Height() { return this._C.offsetHeight; }
	get Canvas() { return this._C; }

	_UpdateRegion(e) {
		if (!this._ScrollBars)
			return;
		// Browsers don't like this, but not sure if there's a better way of doing it.
		// https://firefox-source-docs.mozilla.org/performance/scroll-linked_effects.html
		this._SetCanvas(this._SX + (this._FS.scrollLeft / this._Zoom), this._SY + (this._FS.scrollTop / this._Zoom), this._Zoom, true);
	}

	constructor() {
		this._X = this._Y = 0;
		this._Zoom = 1;

		// Scroll bar handling.
		this._ScrollBars = false;
		this._SX = this._SY = this._SMX = this._SMY = null;

		// Elements
		this._FS = document.getElementById('fakescroll');
		this._C = document.getElementById('canvas');

		this._UR = this._UpdateRegion.bind(this);
		addEventListener('resize', this._UR);
		addEventListener('load', this._UR);
	}

	SetPos(NewX, NewY, NewZoom = this._Zoom, Instant = false) {
		if (!this._ScrollBars) {
			this._SetCanvas(NewX, NewY, NewZoom, Instant);
			return;
		}

		// Redo scrollbars if zoom has changed.
		if (NewZoom != this._Zoom) {
			this.EnableScrollbars(this._SX, this._SY, this._SMX, this._SMY, NewX, NewY, NewZoom);
			return;	// Will return to us from the above.
		}

		let SL = -(this._SX - NewX) * this._Zoom;
		let ST = -(this._SY - NewY) * this._Zoom;

		// If scrollbars already in the right position, just return here.
		function Clamp(Number, Min, Max) {
			return Math.min(Math.max(Number, Min), Max);
		}
		SL = Clamp(SL, 0, this._FS.scrollWidth - this._FS.clientWidth);
		ST = Clamp(ST, 0, this._FS.scrollHeight - this._FS.clientHeight);
		if (Math.round(SL) == Math.round(this._FS.scrollLeft) && Math.round(ST) == Math.round(this._FS.scrollTop)) {  // Rounding needed for JavaScript precision.
			this._SetCanvas(this._SX + (this._FS.scrollLeft / this._Zoom), this._SY + (this._FS.scrollTop / this._Zoom), this._Zoom, Instant);
			return;
		}

		this._SetCanvas(this._SX + (SL / this._Zoom), this._SY + (ST / this._Zoom), this._Zoom, Instant);
		if (Instant) {
			this._FS.scroll(SL, ST);
		} else {
			this._FS.removeEventListener('scroll', this._UR);
			this._FS.addEventListener('scrollend', (e) => {
				this._FS.addEventListener('scroll', this._UR);
			}, {'once': true});
			this._FS.scroll({'left': SL, 'top': ST, 'behavior': 'smooth'});
		}
	}

	EnableScrollbars(MinX, MinY, MaxX, MaxY, NewX = this._X, NewY = this._Y, NewZoom = this._Zoom) {
		this._Zoom = NewZoom;
		this._EnableScrollbars(MinX, MinY, MaxX, MaxY, NewX, NewY);
		this.SetPos(NewX, NewY, this._Zoom, false);
	}

	_EnableScrollbars(MinX, MinY, MaxX, MaxY) {
		this._ScrollBars = true;
		const SA = this._FS.firstChild;
		SA.style.width = ((MaxX - MinX) * this._Zoom) + 'px';
		SA.style.height = ((MaxY - MinY) * this._Zoom) + 'px';
		this._SX = MinX; this._SMX = MaxX;
		this._SY = MinY; this._SMY = MaxY;
		this._FS.style.display = 'block';
		this._FS.addEventListener('scroll', this._UR);
	}

	DisableScrollbars() {
		this._ScrollBars = false;
		this._FS.style.display = 'none';
		this._SX = this._SY = null;
	}
}();

// Shades part of the page we're not looking at.
const Shade = new class {
	constructor() {
		this._S = document.getElementById('shade');
		this._SH = document.getElementById('shadehole');
		this._O = 10;
	}

	SetSize(Width, Height, Left, Top) {
		this._SH.style.width = (Width + this._O) + 'px';
		this._SH.style.height = (Height + this._O) + 'px';
		this._S.style.left = ((Left ? Left : 0) + -this._O) + 'px';
		this._S.style.top = ((Top ? Top : 0) + -this._O) + 'px';
		this._S.style.opacity = .8;
	}
	Hide() {
		this._S.style.opacity = 0;
	}
}();

// Higher-level canvas handler. Positions are rectangles and will adjust zooming by fitting or fill these.
export const HLCanvas = new class {
	_ResizeEvent() {
		if (this._ResizeTimer) {
			clearTimeout(this._ResizeTimer);
			this._ResizeTimer = null;
		}
		this._ResizeTimer = setTimeout(this._DoFocus.bind(this), 500);
	}

	// Taken from; https://stackoverflow.com/questions/13382516/getting-scroll-bar-width-using-javascript
	_CalculateScrollbarSize() {
		const Parent = document.createElement('div');
		Parent.style.visibility = 'hidden';
		Parent.style.overflow = 'scroll';
		document.body.appendChild(Parent);

		const Child = document.createElement('div');
		Parent.appendChild(Child);

		const ScrollbarWidth = (Parent.offsetWidth - Child.offsetWidth);

		Parent.parentNode.removeChild(Parent);

		return ScrollbarWidth;
	}

	constructor(LLC, Shade) {
		this._ScrollbarSize = this._CalculateScrollbarSize();

		this._LL = LLC;
		this._S = Shade;

		this._Focusing = false;
		this._FocusX = this._FocusY = 0;
		this._FocusMaxX = this._FocusMaxY = 100;
		this._FillMode = 0;	// Otherwise, Fit mode.

		this.MinRatio = this._Ratio = this._MaxRatio = null;
		this._ResizeEvent = this._ResizeEvent.bind(this);
	}

	SetFocus(X1, Y1, X2, Y2, FX = undefined, FY = undefined) {
		this._Focusing = true;
		this._FocusX = X1; this._FocusY = Y1;
		this._FocusMaxX = X2; this._FocusMaxY = Y2;

		this._DoFocus(FX, FY);
		addEventListener('resize', this._ResizeEvent);
	}
	RemoveFocus() {
		this._Focusing = false;
		removeEventListener('resize', this._ResizeEvent);
		clearTimeout(this._ResizeTimer);
		this._ResizeTimer = null;
		this._S.Hide();
	}

	_DoFocus(FX = undefined, FY = undefined) {
		if (!this._Focusing)
			return;

		const FocusWidth = this._FocusMaxX - this._FocusX;
		const FocusHeight = this._FocusMaxY - this._FocusY;

		let CanvasWidth = this._LL.Width;
		let CanvasHeight = this._LL.Height;
		let Scrollbars = 0;

		// Check if we need scrollbars and if so, shrink the canvas and redo the math.
		function NeedsScrollbars(FocusSize, Ratio, CanvasSize) {
			const PixelSize = Math.round(FocusSize * Ratio);	// Have to round here due to precision.
			return PixelSize > CanvasSize;
		}

		do {
			const FocusWidthRatio = CanvasWidth / FocusWidth;
			const FocusHeightRatio = CanvasHeight / FocusHeight;

			this._Ratio = Math[this._FillMode ? 'max' : 'min'](FocusWidthRatio, FocusHeightRatio);

			if (!(Scrollbars & 1) && NeedsScrollbars(FocusWidth, this._Ratio, CanvasWidth)) {
				CanvasHeight -= this._ScrollbarSize;
				Scrollbars |= 1;
				if (this._ScrollbarSize)
					continue;
			}
			if (!(Scrollbars & 2) && NeedsScrollbars(FocusHeight, this._Ratio, CanvasHeight)) {
				CanvasWidth -= this._ScrollbarSize;
				Scrollbars |= 2;
				if (this._ScrollbarSize)
					continue;
			}

			break;
		} while (true);

		// If provided, clip to max or min ratio.
		if (this.MinRatio && this._Ratio < this.MinRatio)
			this._Ratio = this.MinRatio;
		else if (this.MaxRatio && this._Ratio > this.MaxRatio)
			this._Ratio = this.MaxRatio;

		// If smaller, place in the center of the canvas.
		function CalcCenterOffset(PixelSize, CanvasSize, Ratio) {
			if (PixelSize < CanvasSize)
				return -((CanvasSize / 2) - (PixelSize / 2)) / Ratio;
			return 0;
		}

		const PixelWidth = FocusWidth * this._Ratio;
		const PixelHeight = FocusHeight * this._Ratio;

		const OffsetX = this._FocusX + CalcCenterOffset(PixelWidth, CanvasWidth, this._Ratio);
		const OffsetY = this._FocusY + CalcCenterOffset(PixelHeight, CanvasHeight, this._Ratio);

		// Set scrollbars if needed.
		if (!Scrollbars) {
			this._LL.DisableScrollbars();
			this._LL.SetPos(OffsetX, OffsetY, this._Ratio);
		} else
			this._LL.EnableScrollbars(OffsetX, OffsetY, OffsetX + FocusWidth, OffsetY + FocusHeight, FX, FY, this._Ratio);

		// Add shade. We'll offset this for the scrollbar if used.
		this._S.SetSize(PixelWidth, PixelHeight,
			(Scrollbars & 2) ? -(this._ScrollbarSize / 2) : null,
			(Scrollbars & 1) ? -(this._ScrollbarSize / 2) : null);
	}

	SetRatioLimits(Min, Max) {
		if (Min !== 0)	// Allows for null.
			this.MinRatio = Min;
		if (Max !== 0)
			this.MaxRatio = Max;
	}
	set FillMode(Mode) { this._FillMode = Mode; }
	get FillMode() { return this._FillMode; }
	get Canvas() { return this._LL.Canvas; }
}(LLCanvas, Shade);
