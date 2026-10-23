'use strict';

import { GetExtension } from './common.js';
import { Loader } from './loader.js';
import {
	BlobReader,
	HttpRangeReader,
	ZipReader,
	TextWriter,
	BlobWriter
} from './dist/zip-custom.js';

export class ZIPJSLoader extends Loader {
	constructor(Input) {
		super();
		this._Entries = [];
		this._Input = '';

		if (Input instanceof Blob)
			this._R = new BlobReader(Input);
		else if (typeof Input === 'string') {
			this._R = new HttpRangeReader(Input);
			this._Input = Input;
		} else
			throw new Error('Input isn\'t a valid input type.');

		this._Z = new ZipReader(this._R);
	}

	async LoadMeta() {
		// Return a copy if we already have it.
		if (this._Meta)
			return await this._Meta;

		const ImageExtensions = ['jpg', 'jpeg', 'png', 'jxl', 'avif', 'avifs', 'webm', 'webp'];
		let MetaEntry = null;

		const ImageCount = await this._Z.getEntries().then((Enteries) => {
			const Entries = new Map();
			const ImageFilenames = [];

			for (const Ent of Enteries) {
				if (Ent.directory) continue;

				const Ext = GetExtension(Ent.filename).toLowerCase();
				if (ImageExtensions.indexOf(Ext) >= 0) {
					ImageFilenames.push(Ent.filename);
					Entries.set(Ent.filename, Ent);
				}

				if (Ent.filename.toLowerCase() == this._MetaFilename)
					MetaEntry = Ent;
			}

			if (!ImageFilenames.length)
				throw new Error('No valid image formats within this ZIP.')

			ImageFilenames.sort();	// This generally should already be the case, but we'll do it anyway.
			for (const Filename of ImageFilenames)
				this._Entries.push(Entries.get(Filename));

			return ImageFilenames.length;
		}).catch((Err) => {
			console.error('Failed to read ZIP contents:', Err);
			return 0;
		});
		if (!ImageCount)
			return false;

		this._MaxDeadImage = this._Entries.length;
		this._SetLayoutEnd(this._Entries.length);

		if (MetaEntry) {
			const TextData = await MetaEntry.getData(new TextWriter());
			if (TextData) {
				const JSONObj = JSON.parse(TextData);
				if (JSONObj) {
					this._ReadMeta(JSONObj);
					return JSONObj;
				}
			}
		}

		if (this._Input) {
			// TODO: Otherwise, if we have the path, also try load meta from the same directory.
		}

		return;
	}

	async LoadImage(Number) {
		const Loaded = this._CommonLoadCheck(Number);
		if (Loaded)
			return await Loaded;

		const Img = new Image();
		this._Loaded.set(Number, Img);
		this._SetPage(Number, {'Img': Img});

		const Entry = this._Entries[Number];
		const BlobData = await Entry.getData(new BlobWriter());
		if (!BlobData) {
			console.error('Failed to obtain blob.');
			return;
		}

		Img.src = URL.createObjectURL(BlobData);

		return Img.decode().then(() => {
			console.log('Loaded image', Number);
			this._SetPage(Number, {'Size': [Img.naturalWidth, Img.naturalHeight]});
			return Img;
		}).catch((Err) => {
			console.error('Failed to load image', Number, ':', Err);
			throw Err;
		});
	}

	UnloadImage(Number) {
		const Loaded = this._Loaded.get(Number);
		if (!Loaded)	// Could be hit if we're on a very slow connection.
			return;
		if (Loaded.src)
			URL.revokeObjectURL(Loaded.src);
		super.UnloadImage(Number);
	}
}
