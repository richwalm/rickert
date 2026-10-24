'use strict';

import { GetExtension } from './common.js';
import { Loader } from './loader.js';
import { DownloadMeta } from './loader_http.js';
import {
	BlobReader,
	HttpRangeReader,
	ZipReader,
	TextWriter,
	BlobWriter
} from './dist/zip-custom.js';

const ImageExtensions = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'jxl': 'image/jxl', 'avif': 'image/avif', 'avifs': 'image/avif-sequence', 'webp': 'image/webp'};

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

		let MetaEntry = null;

		const ImageCount = await this._Z.getEntries().then((Enteries) => {
			const Entries = new Map();
			const ImageFilenames = [];

			for (const Ent of Enteries) {
				if (Ent.directory) continue;

				const Ext = GetExtension(Ent.filename).toLowerCase();
				if (Ext in ImageExtensions) {
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
			const Extension = GetExtension(this._Input);
			const Path = this._Input.slice(0, -Extension.length) + 'json';
			const JSONObj = await DownloadMeta(Path);
			if (JSONObj) {
				this._ReadMeta(JSONObj);
				return JSONObj;
			}
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

		const Ent = this._Entries[Number];
		// zip-js has a MIME type obtainer, but might not be compiled in so we'll use our own.
		const MIMEType = ImageExtensions[GetExtension(Ent.filename)];
		const BlobData = await Ent.getData(new BlobWriter(MIMEType));
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
