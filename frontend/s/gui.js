'use strict';

export class GUI {
	constructor(C) {
		this._C = C;
		this._DefaultSpeed = C.Speed;
		this._InstantMode = false;
		this._PanelMode = false;
		if (this._C.HasViewpoints)
			this.SwitchMode(true);
		addEventListener('keydown', this._HandleKey.bind(this));

		this._Nav = document.getElementById('nav');

		this._IdleTimer = null;
		this._MouseMove();
		document.addEventListener('mousemove', this._MouseMove.bind(this));

		document.getElementById('left').addEventListener('click', this._MovePageKey.bind(this, 0));
		document.getElementById('right').addEventListener('click', this._MovePageKey.bind(this, 1));
	}

	_Idle(e) {
		console.log('Idle reached.');
		document.body.style.cursor = 'none';
		this._Nav.classList.add('idle');
		this._IdleTimer = null;
	}
	_MouseMove(e) {
		if (!this._IdleTimer) {
			// Back from an idle state.
			this._Nav.classList.remove('idle');
			document.body.style.cursor = 'auto';
		} else
			clearTimeout(this._IdleTimer);
		this._IdleTimer = setTimeout(this._Idle.bind(this), 4000);
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
			case 'KeyI':
				this._InstantMode = !this._InstantMode;
				this._C.Speed = this._InstantMode ? 0 : this._DefaultSpeed;
				// TODO: Add message.
				e.preventDefault();
				break;
			case 'KeyD':
				const ExtraPages = this._C.ExtraPages > 0 ? 0 : 1;
				this._C.HideNonFocusPages = true;
				this._PanelMode = false;
				this._C.ExtraPages = ExtraPages;
				e.preventDefault();
				break;
			default:
				return;
		}
	}
}
