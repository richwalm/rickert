'use strict';

export class Loader {
	constructor(Meta) {
		this._Meta = Meta;
		this._MaxValidImage = -1;
		this._MaxDeadImage = Infinity;
		this._ImageSizes = [];
		this._Loaded = new Map();
		if (Meta)
			this._ReadMeta(Meta);
	}

	_ReadMeta(Meta) {
		this._Meta = Meta;
		if (Meta.ImageSizes) {
			this._MaxValidImage = Meta.ImageSizes.length;
			this._MaxDeadImage = this._MaxValidImage + 1;
			this._ImageSizes = Meta.ImageSizes;
		}
	}

	get MaxImages() {
		return this._MaxDeadImage;
	}

	_CheckCache(Number) {
		const Loaded = this._Loaded.get(Number);
		if (Loaded)
			console.log(`Provided cache image ${Number}.`);
		return Loaded;
	}

	_OutsideRange(Number) {
		return (Number < 0 && Number >= this._MaxDeadImage);
	}

	UnloadImage(Number) {
		this._Loaded.delete(Number);
	}

	ImageSize(Number) {
		return this._ImageSizes[Number];
	}
}
