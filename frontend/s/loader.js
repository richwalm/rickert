'use strict';

export class Loader {
	constructor(Meta) {
		this._Meta = Meta;
		this._ImageSizes = [];
		this._MaxDeadImage = Infinity;
		this._Loaded = new Map();
		this._Layout = null;
		this._MetaFilename = 'meta.json';
		if (Meta)
			this._ReadMeta(Meta);
	}

	_ReadMeta(Meta) {
		this._Meta = Meta;
		if (Meta && Meta.ImageSizes) {
			this._ImageSizes = Meta.ImageSizes;
			this._MaxDeadImage = Meta.ImageSizes.length;
			this._SetLayoutEnd(Meta.ImageSizes.length);
		}
	}

	get MaxValidImages() {
		return this._ImageSizes.length;
	}
	get MaxImages() {
		return this._MaxDeadImage;
	}
	get IsStreaming() {
		return (this._ImageSizes.length < this._MaxDeadImage);
	}

	set Layout(Value) { this._Layout = Value; }

	_CheckCache(Number) {
		const Loaded = this._Loaded.get(Number);
		if (Loaded)
			console.log('Provided cache image', Number);
		return Loaded;
	}

	_OutsideRange(Number) {
		return (Number < 0 || Number >= this._MaxDeadImage);
	}

	_CommonLoadCheck(Number) {
		// Range check.
		if (this._OutsideRange(Number))
			throw new Error(`Requested out of range image ${Number}.`)
		// Return if already loaded.
		return this._CheckCache(Number);
	}

	UnloadImage(Number) {
		this._Loaded.delete(Number);
	}

	GetImageSize(Number) {
		return this._ImageSizes[Number];
	}

	get MedianImageSize() {
		let Images = this._ImageSizes.filter(Array);
		if (!Images.length)
			return null;
		Images.sort((A, B) => {
			return (A[0] * A[1]) - (B[0] * B[1]);
		});
		const Mid = Math.floor(Images.length / 2);
		return Images[Mid];
	}

	// Communication with the layout.
	_SetLayoutEnd(EndImageNumber) {
		if (!this._Layout)
			return;
		this._Layout.End = EndImageNumber;
	}
	_SetPage(ImageNumber, Data) {
		if (!this._Layout)
			return;
		if (Data.Size)
			this._ImageSizes[ImageNumber] = Data.Size;
		this._Layout._SetPageInfo(ImageNumber, Data);
	}
}
