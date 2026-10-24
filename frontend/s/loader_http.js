'use strict';

import { Loader } from './loader.js';

export async function DownloadMeta(URL) {
	return fetch(URL).then((Resp) => {
		if (!Resp.ok) {
			if (Resp.status == 404)
				return;
			throw new Error(`Bad status code: ${Resp.status}`);
		}
		return Resp.json();
	}).then((JSON) => {
		return JSON;
	}).catch((Err) => {
		console.error('Failed to load comic meta:', Err);
	});
}

export class HTTPLoader extends Loader {
	GetImageFilename(Number) {
		return this._BasePath + (Number + 1) + this._Extension;
	}

	_AlertSize(Number, Img) {
		const NewSize = [Img.naturalWidth, Img.naturalHeight];
		if (!NewSize[0] || !NewSize[1])	// May trigger on initial render.
			return;

		const CurrentSize = this._ImageSizes[Number];

		if (CurrentSize && CurrentSize[0] == NewSize[0] && CurrentSize[1] == NewSize[1])
			return;	// No change.

		console.log('Image', Number, 'has new size;', NewSize);
		this._ImageSizes[Number] = NewSize;
		this._SetPage(Number, {'Size': NewSize});
		return;
	}

	constructor(BasePath = '', Extension) {
		super();

		if (!Extension)
			Extension = '.jpg';

		this._BasePath = BasePath;
		this._Extension = Extension;
		this._Observed = new Map();

		this._RO = new ResizeObserver((Entries) => {
			for (const ROEntry of Entries) {
				const Ele = ROEntry.target;
				const Number = this._Observed.get(Ele);
				this._AlertSize(Number, Ele);
			}
		});
	}

	UnloadImage(Number) {
		const Loaded = this._Loaded.get(Number);
		if (!Loaded)	// Could be hit if we're on a very slow connection.
			return;
		this._RO.unobserve(Loaded);
		this._Observed.delete(Loaded);
		super.UnloadImage(Number);
	}

	async LoadMeta() {
		// Return a copy if we already have it.
		if (this._Meta)
			return await this._Meta;

		const URL = this._BasePath + this._MetaFilename;
		const JSON = await DownloadMeta(URL);
		if (JSON)
			this._ReadMeta(JSON);
		return JSON;
	}

	async LoadImage(Number) {
		const Loaded = this._CommonLoadCheck(Number);
		if (Loaded)
			return await Loaded;

		// Otherwise, actually load.
		const Img = new Image();
		this._Loaded.set(Number, Img);
		const URL = this.GetImageFilename(Number);
		this._SetPage(Number, {'Img': Img});	// Give it the layout to add to the page.
		// Add to resize observer.
		this._Observed.set(Img, Number);
		this._RO.observe(Img);
		Img.src = URL;

		return Img.decode().then(() => {
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
				this._SetLayoutEnd(Number);
			} else
				throw new Error(`Got ${Resp.status} from fetch() when image ${Number} failed decoding.`);
		}).catch((Err => {
			console.error('404 fetch() check test failed for image', Number, ':', Err);
		}));
	}
}

