'use strict';

export class Loader {
	constructor(Meta) {
		this._Meta = Meta;
		this._ImageSizes = [];
		this._MaxDeadImage = Infinity;
		this._Loaded = new Map();
		if (Meta)
			this._ReadMeta(Meta);
	}

	_ReadMeta(Meta) {
		this._Meta = Meta;
		if (Meta.ImageSizes) {
			this._ImageSizes = Meta.ImageSizes;
			this._MaxDeadImage = Meta.ImageSizes.length;
		}
	}

	get MaxImages() {
		return this._MaxDeadImage;
	}
	get IsStreaming() {
		return (this._ImageSizes.length <= this._MaxDeadImage);
	}

	_CheckCache(Number) {
		const Loaded = this._Loaded.get(Number);
		if (Loaded)
			console.log('Provided cache image', Number);
		return Loaded;
	}

	_OutsideRange(Number) {
		return (Number < 0 && Number >= this._MaxDeadImage);
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
		return Images.length % 2 ? Images[Mid] : ((Images[Mid - 1] + Images[Mid]) / 2);
	}
}
