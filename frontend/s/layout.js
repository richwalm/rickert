'use strict';

import { HLCanvas } from './canvas.js';

export class Layout {
	constructor(Loader, X = 0, Y = 0) {
		this._Loader = Loader;
		Loader.Layout = this;
		this._P = -1; // Current page.
		this._VP = null; // Current viewpoint.
		this._ExtraPages = 0;	// For multiple page mode.

		this._X = X; this._Y = Y; // Canvas offset.
		this._ElementOffsets = []; // Canvas location for each element (X1, Y1, X2, Y2). Doesn't include the above offset.
		this._ElementSizes = []; // Size (W, H) of each element.
		this._FW = null; this._FH = this.constructor.MaxScreenDimension; // Force elements to this size.
		this._PDX = 1; this._PDY = 0; // Direction to add elements to the canvas.
		this._Padding = 0; // Padding between elements.

		this._Loaded = new Map();	// Track of each loaded page, including image element and its parent.

		// Constants.
		this._SafeNeighhours = 2; // Always keep this amount around the current page loaded.
		this._MaxLoaded = 5;		// Max pages to keep loaded.
		this._AddVPs = false;		// App VPs boxes to pages.
		this._DefaultImageSize = [1810, 2560];	// Used for the element size when no size data is loaded.

		// Flags.
		this._MoveByViewpoint = true;
		this._HideNonFocusPages = false;
		this._FillMode = false;

		// Panels.
		this._Viewpoints = [];
	}

	static get MaxScreenDimension() {
		// This has quite an effect on performance, especially on mobile devices.
		// When too small, the browser may shrink images down when scrolling, causing noticeable blurring.
		// When too large, can be jittery and very flickery on mobile devices.
		// As mobile devices can be flipped, we'll use the largest of the two.
		return Math.max(screen.width, screen.height);
	}

	async ReadMeta() {
		const Meta = await this._Loader.LoadMeta();
		if (!Meta)
			return Meta;	// Returns false when we can't continue.

		if (Meta.ImageSizes) {
			if (Meta.Direction) {
				switch (Meta.Direction) {
					case 'Left':
						this._PDX = -1;
						break;
					case 'Down':
						this._PDX = 0;
						this._PDY = 1;
						this._FH = null;
						this._FW = this.constructor.MaxScreenDimension;
						break;
					case 'Up':	// Is one this even a thing?
						this._PDX = 0;
						this._PDY = -1;
						this._FH = null;
						this._FW = this.constructor.MaxScreenDimension;
					default:
						break;
				}
			}
			for (let i = 0; i < Meta.ImageSizes.length; i++)
				this._ElementSizes[i] = this._CalcEleSize(Meta.ImageSizes[i]);
			this._CalcPageOffset(0);
		}

		if (Meta.Viewpoints)
			this._Viewpoints = Meta.Viewpoints;

		return Meta;
	}

	IsPageVisible(PageNumber, Padding = 0) {
		return !(PageNumber < this._P - Padding || PageNumber > this._P + this._ExtraPages + Padding);
	}

	// Setters & getters.
	set HideNonFocusPages(Value) {
		if (this._HideNonFocusPages == Value)
			return;
		this._Loaded.forEach((Slot, Key) => {
			Slot.Ele.style.opacity = (!Value || this.IsPageVisible(Key) ? 1 : 0);
		});
		this._HideNonFocusPages = Value;
	}
	get HideNonFocusPages() { return this._HideNonFocusPages; };

	set MoveByViewpoint(Value) {
		if (this._MoveByViewpoint == Value)
			return;
		const MinPage = Math.max(0, this._P);
		let VP = null;
		if (Value)
			VP = (this._Viewpoints[MinPage] ? 0 : null)
		this.SetPage(MinPage, VP, 0);
		this._MoveByViewpoint = Value;
	}
	get MoveByViewpoint() { return this._MoveByViewpoint; };

	get Direction() { return this._PDX >= 0; };

	set ShowVPs(Value) {
		if (this._AddVPs == Value)
			return;
		if (!Value) {
			const VPs = HLCanvas.Canvas.getElementsByClassName('vp');
			while (VPs.length > 0)
				VPs[0].remove();
		} else {
			this._Loaded.forEach((Slot, Key) => {
				const Viewpoints = this._Viewpoints[Key];
				if (Viewpoints)
					this._AddVPEles(Slot.Ele, Viewpoints);
			});
		}
		this._AddVPs = Value;
	}
	get ShowVPs() { return this._AddVPs; };
	get HasViewpoints() { return Boolean(this._Viewpoints); }

	set FillMode(Value) {
		if (this._FillMode == Value)
			return;
		HLCanvas.FillMode = Value;
		this.SetPage(this._P, this._VP, this._ExtraPages);
		this._FillMode = Value;
	}
	get FillMode() { return this._FillMode; };

	set ExtraPages(Value) {
		if (this._ExtraPages == Value)
			return;
		this.SetPage(this._P, null, Value);
		return;
	}
	get ExtraPages() { return this._ExtraPages; }

	_CalcEleSize(ImageSize) {
		// Returns element size, but takes in account of forcing a size, keeping the ratio when needed.
		if (this._FW && this._FH)
			return [this._FW, this._FH];
		else if (ImageSize) {
			let W = ImageSize[0], H = ImageSize[1];
			if (this._FW) {
				H *= (this._FW / W);
				W = this._FW;
			} else if (this._FH) {
				W *= (this._FH / H);
				H = this._FH;
			}
			return [W, H];
		}
	}

	_SetFocus(PageNumber, ViewpointNumber, ExtraPages) {
		let Offset = this._ElementOffsets[PageNumber];
		if (ExtraPages) {
			Offset = structuredClone(Offset);
			// Combine any extra pages.
			for (let i = 0; i < ExtraPages; i++) {
				const ExtraPage = this._ElementOffsets[PageNumber + i + 1];
				Offset.X1 = Math.min(Offset.X1, ExtraPage.X1);
				Offset.Y1 = Math.min(Offset.Y1, ExtraPage.Y1);
				Offset.X2 = Math.max(Offset.X2, ExtraPage.X2);
				Offset.Y2 = Math.max(Offset.Y2, ExtraPage.Y2);
			}
		}

		let FX = (this._PDX >= 0 ? Offset.X1 : Offset.X2) + this._X;
		let FY = (this._PDY >= 0 ? Offset.Y1 : Offset.Y2) + this._Y;
		if (ViewpointNumber === null) {
			HLCanvas.SetFocus(Offset.X1 + this._X, Offset.Y1 + this._Y, Offset.X2 + this._X, Offset.Y2 + this._Y, FX, FY);
			return;
		}
		const Viewpoint = this._Viewpoints[PageNumber][ViewpointNumber];
		const Size = this._ElementSizes[PageNumber];
		let X = Viewpoint.X * Size[0];
		let Y = Viewpoint.Y * Size[1];
		const W = Viewpoint.W * Size[0];
		const H = Viewpoint.H * Size[1];
		X += Offset.X1 + this._X;
		Y += Offset.Y1 + this._Y;
		HLCanvas.SetFocus(X, Y, X + W, Y + H, FX, FY);
	}

	CullPage(PageNumber) {
		const Page = this._Loaded.get(PageNumber);
		if (!Page)
			return false;
		Page.Ele.remove();
		this._Loader.UnloadImage(PageNumber);
		this._Loaded.delete(PageNumber);
		return true;
	}
	set End(EndPageNumber) {
		EndPageNumber = Math.max(this._P + 1, EndPageNumber);
		for (const [Key] of this._Loaded) {
			if (Key >= EndPageNumber)
				this.CullPage(Key);
		}
		this._ElementOffsets.length = EndPageNumber;
		this._ElementSizes.length = EndPageNumber;
	}
	_CullLoadedPages() {
		let ToRemove = this._Loaded.size - (this._MaxLoaded - 1); // -1 for the upcoming page slot.
		if (ToRemove <= 0)
			return;

		for (const [Key] of this._Loaded) {
			// Avoid removing pages around the current page.
			if (this.IsPageVisible(Key, this._SafeNeighhours))
				continue;
			this.CullPage(Key);
			if (--ToRemove <= 0)
				break;
		}
	}

	_AddVPEles(Ele, Viewpoints) {
		const Amount = Viewpoints.length;
		let Count = 0;
		for (const VP of Viewpoints) {
			const VPEle = document.createElement('div');
			VPEle.classList.add('vp');
			VPEle.style.left = (VP.X * 100) + '%';
			VPEle.style.top = (VP.Y * 100) + '%';
			VPEle.style.width = (VP.W * 100) + '%';
			VPEle.style.height = (VP.H * 100) + '%';
			VPEle.style.boxShadow = 'inset 0 0 100px Red';
			VPEle.textContent = Count++;
			Ele.appendChild(VPEle);
		};
	}

	_MakePageSize(PageNumber) {
		const ImgSize = this._Loader.GetImageSize(PageNumber) || this._Loader.MedianImageSize || this._DefaultImageSize;
		const EleSize = this._ElementSizes[PageNumber] = this._CalcEleSize(ImgSize);
		return EleSize;
	}

	_SetPageSizePos(Ele, EleSize, PageNumber) {
		Ele.style.width = EleSize[0] + 'px';
		Ele.style.height = EleSize[1] + 'px';
		const EleOffset = this._ElementOffsets[PageNumber];
		Ele.style.transform = `translate(${EleOffset.X1 + this._X}px, ${EleOffset.Y1 + this._Y}px)`;
	}

	_SetPageInfo(PageNumber, Data) {
		// New image size.
		if (Data.Size) {
			const EleSize = this._ElementSizes[PageNumber];
			const NewEleSize = this._CalcEleSize(Data.Size);
			// Check if there's a change to the element size.
			if (!EleSize || EleSize[0] != NewEleSize[0] || EleSize[1] != NewEleSize[1]) {
				console.log('Loaded image for page', PageNumber, 'has a different element size. Recalculating offsets.')
				this._ElementSizes[PageNumber] = NewEleSize;
				this._CalcPageOffset(PageNumber);
			}
		}
		// Append img to element.
		if (Data.Img) {
			const Slot = this._Loaded.get(PageNumber);
			if (Slot.Ele) {
				if (this._FW)
					Data.Img.style.width = this._FW + 'px';
				if (this._FH)
					Data.Img.style.height = this._FH + 'px';
				Slot.Ele.appendChild(Data.Img);
				Slot['Img'] = Data.Img;
			}
		}
	}

	SetBGNote(Parent, Msg) {
		let Note = Parent.getElementsByClassName('bgnote');
		if (!Note.length && Msg) {
			Note = document.createElement('div');
			Note.classList.add('bgnote');
			Parent.appendChild(Note);
		} else if (!Msg) {
			Note[0].remove();
			return
		} else
			Note = Note[0];
		Note.textContent = Msg;
	}

	// Load a page.
	LoadPage(PageNumber) {
		if (this._Loaded.has(PageNumber)) // Already loaded.
			return;
		if (PageNumber < 0 || PageNumber >= this._Loader.MaxImages)
			return;
		this._CullLoadedPages();
		let Slot = {};

		let EleSize = this._ElementSizes[PageNumber] || this._MakePageSize(PageNumber);
		if (!this._ElementOffsets[PageNumber])
			this._CalcPageOffset(PageNumber);

		// Create a DOM Element.
		const Ele = document.createElement('div');
		Slot['Ele'] = Ele;
		Ele.classList.add('p');
		this._SetPageSizePos(Ele, EleSize, PageNumber);
		Ele.classList.add('loading');
		this.SetBGNote(Ele, 'Loading');
		if (this._HideNonFocusPages)
			Ele.style.opacity = 0;
		HLCanvas.Canvas.appendChild(Ele);

		// Add panel viewpoints.
		if (this._AddVPs) {
			const Viewpoints = this._Viewpoints[PageNumber];
			if (Viewpoints)
				this._AddVPEles(Ele, Viewpoints);
		}

		this._Loaded.set(PageNumber, Slot);

		// Download image in the loading zone.
		this._Loader.LoadImage(PageNumber).then((Img) => {
			if (!Ele.isConnected) {
				this._Loader.UnloadImage(PageNumber);
				console.warn('Loaded image', PageNumber, 'but page has been removed!');
				return;
			}
			Ele.classList.add('loaded');
			this.SetBGNote(Ele, null);
		}).catch((Err) => {
			if (Slot.Img)
				Slot.Img.remove();
			Ele.classList.add('error');
			this.SetBGNote(Ele, 'Error');
			console.error('Failed to load page', PageNumber, ':', Err);
		}).finally(() => {
			Ele.classList.remove('loading');
		});
	}

	_ShowHidePage(PageNumber, Extra, Show) {
		if (!this._HideNonFocusPages)
			return;
		for (let i = 0; i <= Extra; i++) {
			const Slot = this._Loaded.get(PageNumber + i);
			if (!Slot)
				continue;
			Slot.Ele.style.opacity = (Show ? 1 : 0);
		}
		return;
	}

	// Set the page/viewpoint focus.
	SetPage(PageNumber, ViewpointNumber = null, ExtraPages = 0) {
		if (PageNumber >= this._Loader.MaxImages)
			return false;
		if (ViewpointNumber !== null) {
			const Viewpoints = this._Viewpoints[PageNumber];
			if (!Viewpoints || ViewpointNumber < 0 || ViewpointNumber >= Viewpoints.length)
				return false;
			ExtraPages = 0;	// If provided both for some reason, we'll remove extras.
		}
		if (PageNumber + ExtraPages < 0)
			return false;

		if (PageNumber != this._P || ExtraPages != this._ExtraPages) {
			this._ShowHidePage(this._P, this._ExtraPages, false);

			this._ExtraPages = ExtraPages;
			// With extra pages, turn off viewpoints.
			if (this._ExtraPages)
				this._MoveByViewpoint = false;
			this.LoadPage(PageNumber);
			this._P = PageNumber;	// Set here so LoadPage knows what to cull.
			for (let i = PageNumber + 1; i <= PageNumber + ExtraPages + this._SafeNeighhours; i++)
				this.LoadPage(i);
			for (let i = PageNumber - 1; i >= PageNumber - this._SafeNeighhours; i--)
				this.LoadPage(i);
			this._ShowHidePage(PageNumber, ExtraPages, true);
		}

		this._VP = ViewpointNumber;
		const MinPage = Math.max(0, PageNumber);
		const MaxPage = Math.min(this._Loader.MaxImages - 1, PageNumber + ExtraPages);
		const ValidExtraPages = MaxPage - MinPage;
		this._SetFocus(MinPage, ViewpointNumber, ValidExtraPages);
		return true;
	}

	_GetNewPage(Direction) {
		let NewNumber = this._P + (this._ExtraPages + 1) * Direction;
		// In case the user has moved too far forward in streaming mode, jump back to the last valid image.
		if (Direction < 0 && this._Loader.MaxValidImages)
			NewNumber = Math.min(NewNumber, this._Loader.MaxValidImages - 1);
		return NewNumber;
	}

	// Move forward or back by pages or viewpoints.
	Move(Direction) {
		switch (Direction) {
			case -1:
			case 1:
				break;
			default:
				return;
		}

		if (!this._MoveByViewpoint) {
			let PageNumber = this._GetNewPage(Direction);
			return this.SetPage(PageNumber, null, this._ExtraPages);
		}

		// Move by viewpoint.
		const Viewpoints = this._Viewpoints[this._P];
		if (Viewpoints) {
			let NewVP = this._VP;
			if (NewVP === null) {
				NewVP = (Direction > 0 ? 0 : Viewpoints.length - 1);
				console.warn('No viewpoint number when moving by viewpoint. Setting to', NewVP);
			}
			else
				NewVP += Direction;
			if (!(NewVP < 0 || NewVP >= Viewpoints.length))
				return this.SetPage(this._P, NewVP, 0);
		}

		// Head to next or previous page.
		function GetFirstOrLastViewpoint(Viewpoints, Direction) {
			if (!Viewpoints)
				return null;
			return (Direction > 0 ? 0 : Viewpoints.length - 1);
		}

		let NewPage = this._GetNewPage(Direction);
		let NewVP = GetFirstOrLastViewpoint(this._Viewpoints[NewPage], Direction);
		return this.SetPage(NewPage, NewVP, 0);
	}

	// Calculate poisition of page elements.
	_MakePageOffset(Page) {
		const AvgImgSize = this._Loader.MedianImageSize || this._DefaultImageSize;
		const AvgEleSize = this._CalcEleSize(AvgImgSize);
		const X = ((AvgEleSize[0] + this._Padding) * Page) * this._PDX;
		const Y = ((AvgEleSize[1] + this._Padding) * Page) * this._PDY;
		const EleSize = this._ElementSizes[Page] || AvgEleSize;
		return {'X1': X, 'Y1': Y, 'X2': X + EleSize[0], 'Y2': Y + EleSize[1]};
	}
	_CalcPageBasePos(PO, Forward = true) {
		// Base position is the edge (plus padding if any) or center, depending on the direction varibles.
		function CalcCenter(Min, Max) {
			return ((Max - Min) / 2) + Min;
		}
		function HandleAxis(Dir, Min, Max, Padding = 0) {
			if (!Dir)
				return CalcCenter(Min, Max)
			return Math[Dir < 0 ? 'min' : 'max'](Min - Padding, Max + Padding);
		}
		const X = HandleAxis(Forward ? this._PDX : -this._PDX, PO['X1'], PO['X2'], this._Padding);
		const Y = HandleAxis(Forward ? this._PDY : -this._PDY, PO['Y1'], PO['Y2'], this._Padding);
		return [X, Y];
	}
	_CalcNewPagePos(PS, Forward = true) {
		const X = (((Forward ? this._PDX : -this._PDX) - 1) / 2) * PS[0];
		const Y = (((Forward ? this._PDY : -this._PDY) - 1) / 2) * PS[1];
		return [X, Y];
	}
	_UpdateOffsetChain(PageNumber, Dir) {
		// The first page is never be adjusted. Just used for its offset.
		let P = this._ElementOffsets[PageNumber];
		do {
			PageNumber += Dir;
			const S = this._ElementSizes[PageNumber];
			if (!S)
				break;
			const BasePos = this._CalcPageBasePos(P, Dir > 0);
			const NewPos = this._CalcNewPagePos(S, Dir > 0);
			const NewX = BasePos[0] + NewPos[0];
			const NewY = BasePos[1] + NewPos[1];
			P = this._ElementOffsets[PageNumber] = {'X1': NewX, 'Y1': NewY, 'X2': NewX + S[0], 'Y2': NewY + S[1]};
		} while (true);
	}
	_UpdateLoadedEle(SetPage = true) {
		// Update any elements already loaded.
		this._Loaded.forEach((Slot, Key) => {
			if (!this._ElementOffsets[Key]) {
				this.CullPage(Key);
				return;
			}
			const EleSize = this._ElementSizes[Key];
			this._SetPageSizePos(Slot.Ele, EleSize, Key);
		});

		// If we're on the focused page, update instantly.
		if (SetPage) {
			console.log('Instant snapping to', this._P);
			const OldSpeed = HLCanvas.Speed;
			HLCanvas.Speed = 0;
			this.SetPage(this._P, this._VP, this._ExtraPages);
			HLCanvas.Speed = OldSpeed;
		}
	}
	// Main offset calculation. Called for elements without known offsets, or when a page has been resized.
	_CalcPageOffset(PageNumber, Focus = this._P) {
		const Diff = PageNumber - Focus;
		const Dir = Diff < 0 ? -1 : (Diff > 0 ? 1 : Diff);
		let Cleared = false;
		if (!this._ElementOffsets[PageNumber - Dir]) {
			// Caught when the user has requested a page unconnected to the known offsets.
			// Clear all offsets and start a new element anew.
			console.info('Clearing offsets as no neighbour for', PageNumber);
			this._ElementOffsets = [];
			this._ElementOffsets[PageNumber] = this._MakePageOffset(PageNumber);
			Cleared = true;
		}

		if (!Cleared && Dir) {
			this._UpdateOffsetChain(PageNumber - Dir, Dir);
		} else {
			// The current page size is updated. Update in both directions.
			console.info('Offset update for base page', PageNumber);
			const P = this._ElementOffsets[PageNumber];
			P.X2 = P.X1 + this._ElementSizes[PageNumber][0];
			P.Y2 = P.Y1 + this._ElementSizes[PageNumber][1];
			this._UpdateOffsetChain(PageNumber, 1);
			this._UpdateOffsetChain(PageNumber, -1);
		}

		this._UpdateLoadedEle(!Dir && !Cleared);

		return;
	}
}
