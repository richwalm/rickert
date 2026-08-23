'use strict';

import { Loader } from './loader.js';

export class HTTPLoader extends Loader {
	GetImageFilename(Number) {
		return this._BasePath + (Number + 1) + this._Extension;
	}

	constructor(BasePath = '', Extension) {
		super();

		if (!Extension)
			Extension = '.jpg';

		this._BasePath = BasePath;
		this._Extension = Extension;
	}

	async LoadMeta() {
		// Return a copy if we already have it.
		if (this._Meta)
			return await this._Meta;

		const URL = this._BasePath + 'meta.json';
		return fetch(URL).then((Resp) => {
			if (!Resp.ok) {
				if (Resp.status == 404)
					return;
				throw new Error(`Bad status code: ${Resp.status}`);
			}
			return Resp.json();
		}).then((JSON) => {
			this._ReadMeta(JSON);
			return JSON;
		}).catch((Err) => {
			console.error('Failed to load comic meta:', Err);
		});
	}

	async LoadImage(Number) {
		// Range check.
		if (this._OutsideRange(Number))
			throw new Error(`Requested out of range image ${Number}.`)

		// Return if already loaded.
		const Loaded = this._CheckCache(Number);
		if (Loaded)
			return await Loaded;

		// Otherwise, actually load.
		const Img = new Image();
		const URL = this.GetImageFilename(Number);
		Img.src = URL;
		return Img.decode().then(() => {
			this._ImageSizes[Number] = [Img.width, Img.height];
			this._Loaded.set(Number, Img);
			console.log('Loaded image', Number);
			return Img;
		}).catch((Err) => {
			console.error('Failed to load image', Number, ':', Err);
			// Wish there was a way to get the status code from Err, but there isn't so we have to do this.
			this._EndOfImagesCheck(Img.src, Number);
			throw Err;
		});
	}

	_EndOfImagesCheck(Src, Number) {
		if (Number >= this._MaxDeadImage)
			return;

		fetch(Src).then((Resp) => {
			if (Resp.status == 404) {
				this._MaxDeadImage = Math.min(Number, this._MaxDeadImage);	// Use min in case multiple requests are occuring.
				console.log('Reached 404 error at image', Number);
				// TODO: Send a message back to the layout so any extra elements can be deleted.
			} else
				throw new Error(`Got ${Resp.status} from fetch() when image ${Number} failed decoding.`);
		}).catch((Err => {
			console.error('404 fetch() check test failed for image', Number, ':', Err);
		}));
	}
}

