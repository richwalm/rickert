'use strict';

export class GUI {
	constructor(C) {
		this._C = C;
		this._PanelMode = false;
		if (this._C.HasViewpoints)
			this.SwitchMode(true);
		addEventListener('keydown', this._HandleKey.bind(this));
		const LeftArea = document.getElementById('left');
		const RightArea = document.getElementById('right');
		LeftArea.addEventListener('click', this._MovePageKey.bind(this, 0));
		RightArea.addEventListener('click', this._MovePageKey.bind(this, 1));
		LeftArea.addEventListener('mouseenter', (e) => { LeftArea.firstChild.style.opacity = 1; });
		LeftArea.addEventListener('mouseleave', (e) => { LeftArea.firstChild.style.opacity = 0; });
		RightArea.addEventListener('mouseenter', (e) => { RightArea.firstChild.style.opacity = 1; });
		RightArea.addEventListener('mouseleave', (e) => { RightArea.firstChild.style.opacity = 0; });
	}

	static SetMessage(Message) {
		const MsgEle = document.getElementById('msg');
		if (!Message) {
			MsgEle.style.display = 'none';
			return;
		}
		MsgEle.firstChild.textContent = Message;
		MsgEle.style.display = 'flex';
	}

	_MovePageKey(Dir) {
		if (!this._C.Direction)	// Flip direction for LTR comics.
			Dir = !Dir;
		let Return = this._C.Move(Dir ? 1 : -1);
		if (!Return) {
			// TODO: Pop up with a do you want to go to the next comic message. Otherwise, mention that they're going to wrong way.
		}
		return Return;
	}

	SwitchMode(WantPanelMode) {
		if (WantPanelMode && !this._C.HasViewpoints) {
			// TODO: Pop up with this comic doesn't have viewpoints.
			return;
		}

		this._C.MoveByViewpoint = WantPanelMode;
		this._C.HideNonFocusPages = !WantPanelMode;
		if (WantPanelMode)
			this._C.FillMode = false;

		// TODO: Pop up with switch message.
		this._PanelMode = WantPanelMode;
	}

	_HandleKey(e) {
		switch (e.code) {
			case 'ArrowLeft':
				if (this._MovePageKey(0))
					e.preventDefault();
				break;
			case 'ArrowRight':
				if (this._MovePageKey(1))
					e.preventDefault();
				break;
			case 'KeyX':
				this._C.ShowVPs = !this._C.ShowVPs;
				// TODO: Should display a message about this.
				e.preventDefault();
				break;
			case 'KeyP':
				this.SwitchMode(!this._PanelMode);
				e.preventDefault();
				break;
			case 'KeyF':
				this._C.FillMode = !this._C.FillMode;
				e.preventDefault();
				break;
			default:
				return;
		}
	}
}
