'use strict';

import { HLCanvas } from './canvas.js';

export class Comic {
	constructor(Meta, BasePath = '', X = 0, Y = 0) {
		this._M = Meta;
		this._BP = BasePath;
		this._Total = 0;
		this._P = -1; // Current page.
		this._VP = null; // Current viewpoint.

		this._X = X; this._Y = Y; // Canvas offset.
		this._ElementOffsets = []; // Canvas location for each element (X1, Y1, X2, Y2). Doesn't include the above offset.
		this._ElementSizes = []; // Size (W, H) of each element.
		this._FW = this._FH = null; // Force elements to this size.
		this._PDX = 1; this._PDY = 0; // Direction to add elements to the canvas.
		this._Padding = 0; // Padding between elements.

		this._ImageSizes = []; // Size of each image. Might contains gaps if streaming.
		this._Loaded = new Map();	// Track of each loaded page, including image and element.

		// Constants.
		this._SafeNeighhours = 2; // Always keep this amount around the current page loaded.
		this._MaxLoaded = 7;		// Max pages to keep loaded.
		this._AddVPs = false;		// App VPs boxes to pages.

		// Flags.
		this._MoveByViewpoint = true;
		this._HideNonFocusPages = false;
		this._FillMode = false;

		// Use what we can from the meta.
		if (Meta.Pages) {
			if (Meta.Direction) {
				switch (Meta.Direction) {
					case 'Left':
						this._PDX = -1;
						break;
					case 'Down':
						this._PDX = 0;
						this._PDY = 1;
						break;
					case 'Up':	// Is one this even a thing?
						this._PDX = 0;
						this._PDY = -1;
					default:
						break;
				}
			}
			this._ImageSizes = Meta.Pages;
			this._Total = Meta.Pages.length;
			for (let i = 0; i < Meta.Pages.length; i++)
				this._ElementSizes[i] = this._CalcEleSize(Meta.Pages[i]);
			this._CalcEleOffsets();
		}

		// Panels.
		this._Viewpoints = [];
		if (Meta.Viewpoints)
			this._Viewpoints = Meta.Viewpoints;
	}

	// Setters & getters.
	set HideNonFocusPages(Value) {
		if (this._HideNonFocusPages == Value)
			return;
		this._Loaded.forEach((Slot, Key) => {
			Slot.Ele.style.opacity = (!Value || Key == this._P ? 1 : 0);
		});
		this._HideNonFocusPages = Value;
	}
	get HideNonFocusPages() { return this._HideNonFocusPages; };

	set MoveByViewpoint(Value) {
		if (this._MoveByViewpoint == Value)
			return;
		if (!Value)
			this._VP = null;
		else
			this._VP = (this._Viewpoints[this._P] ? 0 : null)
		this.SetPage(this._P, this._VP);
		this._MoveByViewpoint = Value;
	}
	get MoveByViewpoint() { return this._MoveByViewpoint; };

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

	set FillMode(Value) {
		if (this._FillMode == Value)
			return;
		HLCanvas.FillMode = Value;
		this.SetPage(this._P, this._VP);
		this._FillMode = Value;
	}
	get FillMode() { return this._FillMode; };

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

	_SetFocus(PageNumber, ViewpointNumber) {
		const Offset = this._ElementOffsets[PageNumber];

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

	_LoadedImage(Slot, PageNumber) {
		Slot.Ele.style.backgroundColor = 'White';
		console.log('Finished loading page', PageNumber);
	}
	_LoadedImageError(Slot, PageNumber) {
		Slot.Image.remove();
		Slot.Ele.style.backgroundColor = 'Red'; // TODO: Better error.
		console.error('Failed to load page', PageNumber);
	}

	_CullLoadedPages() {
		let ToRemove = this._Loaded.size - this._MaxLoaded;
		if (ToRemove <= 0)
			return;

		for (const [Key] of this._Loaded) {
			// Avoid removing pages around the current page.
			let Diff = Key - this._P;
			if (Math.abs(Diff) <= this._SafeNeighhours)
				continue;

			const Page = this._Loaded.get(Key);
			Page.Ele.remove();
			this._Loaded.delete(Key);
			console.log('Culled page', Key);
			if (--ToRemove <= 0)
				break;
		}
	}

	_AddVPEles(Ele, Viewpoints) {
		const Amount = Viewpoints.length;
		let Count = 0;
		Viewpoints.forEach((VP) => {
			const VPEle = document.createElement('div');
			VPEle.classList.add('vp');
			VPEle.style.left = (VP.X * 100) + '%';
			VPEle.style.top = (VP.Y * 100) + '%';
			VPEle.style.width = (VP.W * 100) + '%';
			VPEle.style.height = (VP.H * 100) + '%';
			VPEle.style.boxShadow = 'inset 0 0 100px Red';
			VPEle.textContent = Count++;
			Ele.appendChild(VPEle);
		});
	}

	LoadPage(PageNumber) {
		if (this._Loaded.has(PageNumber)) // Already loaded.
			return;
		if (PageNumber < 0 || PageNumber >= this._Total)
			return;
		this._CullLoadedPages();
		let Slot = {};

		const EleSize = this._ElementSizes[PageNumber];

		// Create a DOM Element.
		const Ele = document.createElement('div');
		Slot['Ele'] = Ele;
		Ele.classList.add('p');
		Ele.style.width = EleSize[0] + 'px';
		Ele.style.height = EleSize[1] + 'px';
		const EleOffset = this._ElementOffsets[PageNumber];
		Ele.style.transform = `translate(${EleOffset.X1 + this._X}px, ${EleOffset.Y1 + this._Y}px)`;
		Ele.style.backgroundColor = (PageNumber & 1 ? 'Gray' : 'Silver'); // TODO: Use loading graphic.
		if (this._HideNonFocusPages)
			Ele.style.opacity = 0;
		HLCanvas.Canvas.appendChild(Ele);

		// Add panel viewpoints.
		if (this._AddVPs) {
			const Viewpoints = this._Viewpoints[PageNumber];
			if (Viewpoints)
				this._AddVPEles(Ele, Viewpoints);
		}

		// Download image in the loading zone.
		// Loading zone is used to obtain the image size earlier by an observer.
		const EleImage = new Image();
		Slot['Image'] = EleImage;
		EleImage.onload = this._LoadedImage.bind(this, Slot, PageNumber);
		EleImage.onerror = this._LoadedImageError.bind(this, Slot, PageNumber);
		Ele.appendChild(EleImage);
		EleImage.src = this._BP + (PageNumber + 1) + '.jpg';

		this._Loaded.set(PageNumber, Slot);
		console.log('Loading page', PageNumber);
	}

	_ShowHidePage(PageNumber, Show) {
		if (!this._HideNonFocusPages)
			return;
		const Slot = this._Loaded.get(PageNumber);
		if (!Slot)
			return;
		Slot.Ele.style.opacity = (Show ? 1 : 0);
		return;
	}

	SetPage(PageNumber, ViewpointNumber = null) {
		// Loads the page and pages around it, and set the focus.
		if (PageNumber < 0 || PageNumber >= this._Total)
			return false;

		if (ViewpointNumber !== null) {
			const Viewpoints = this._Viewpoints[PageNumber];
			if (!Viewpoints || ViewpointNumber < 0 || ViewpointNumber >= Viewpoints.length)
				return false;
		}

		if (PageNumber != this._P) {
			this._ShowHidePage(this._P, false);
			this._P = PageNumber;
			for (let i = PageNumber - this._SafeNeighhours; i <= PageNumber + this._SafeNeighhours; i++)
				this.LoadPage(i);
			this._ShowHidePage(PageNumber, true);
		}

		this._VP = ViewpointNumber;
		this._SetFocus(PageNumber, ViewpointNumber);
		return true;
	}

	Move(Direction) {
		// Move forward or back by pages or viewpoints.
		switch (Direction) {
			case -1:
			case 1:
				break;
			default:
				return;
		}

		if (!this._MoveByViewpoint)
			return this.SetPage(this._P + Direction);

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
				return this.SetPage(this._P, NewVP);
		}

		// Head to next or previous page.
		function GetFirstOrLastViewpoint(Viewpoints, Direction) {
			if (!Viewpoints)
				return null;
			return (Direction > 0 ? 0 : Viewpoints.length - 1);
		}

		let NewPage = this._P + Direction;
		let NewVP = GetFirstOrLastViewpoint(this._Viewpoints[NewPage], Direction);
		return this.SetPage(NewPage, NewVP);
	}

	// Calculate poisition of pages.
	_CalcPageBasePos(PO) {
		function CalcCenter(Min, Max) {
			return ((Max - Min) / 2) + Min;
		}
		function HandleAxis(Dir, Min, Max, Padding = 0) {
			if (!Dir)
				return CalcCenter(Min, Max)
			return Math[Dir < 0 ? 'min' : 'max'](Min - Padding, Max + Padding);
		}
		const X = HandleAxis(this._PDX, PO['X1'], PO['X2'], this._Padding);
		const Y = HandleAxis(this._PDY, PO['Y1'], PO['Y2'], this._Padding);
		return [X, Y];
	}
	_CalcNewPagePos(PS) {
		const X = ((this._PDX - 1) / 2) * PS[0];
		const Y = ((this._PDY - 1) / 2) * PS[1];
		return [X, Y];
	}
	_CalcEleOffsets(StartOffset = 0) {
		let P;
		if (!StartOffset) {
			// Initial page.
			const S = this._ElementSizes[0];
			P = {'X1': 0, 'Y1': 0, 'X2': S[0], 'Y2': S[1]};
			this._ElementOffsets[0] = P;
			StartOffset++;
		} else
			P = this._ElementOffsets[StartOffset - 1];

		for (let i = StartOffset; i < this._ElementSizes.length; i++) {
			const S = this._ElementSizes[i];
			const BasePos = this._CalcPageBasePos(P);
			const NewSize = this._CalcNewPagePos(S);
			const NewX = BasePos[0] + NewSize[0];
			const NewY = BasePos[1] + NewSize[1];
			let NP = {'X1': NewX, 'Y1': NewY, 'X2': NewX + S[0], 'Y2': NewY + S[1]}
			this._ElementOffsets[i] = NP;
			P = NP;
		}
	}

}

