function MyControls( object, domElement ) {
	var STATE = { NONE: - 1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 };

	var _this = this;
	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;
	
	this.screen = { left: 0, top: 0, width: 0, height: 0 };

	this.rotateSpeed = 1.0;
	this.zoomSpeed = 1.2;
	this.panSpeed = 0.3;

	this.staticMoving = false;
	this.dynamicDampingFactor = 0.2;

	this.minDistance = 0;
	this.maxDistance = Infinity;


	this.target = new THREE.Vector3();

	var EPS = 0.000001;

	var lastPosition = new THREE.Vector3();

	var _state = STATE.NONE,
	_prevState = STATE.NONE,
	
	_eye = new THREE.Vector3();
	
	_movePrev = new THREE.Vector2(),
	_moveCurr = new THREE.Vector2(),

	_lastAxis = new THREE.Vector3(),
	_lastAngle = 0,

	_zoomStart = new THREE.Vector2(),
	_zoomEnd = new THREE.Vector2(),

	_touchZoomDistanceStart = 0,
	_touchZoomDistanceEnd = 0,

	_panStart = new THREE.Vector2(),
	_panEnd = new THREE.Vector2();
	
function keydown( event ) {
if ( _state !== STATE.NONE ) {return;} 
//else if ( event.keyCode === _this.keys[ STATE.ROTATE ]) { _state = STATE.ROTATE;} 
//else if ( event.keyCode === _this.keys[ STATE.ZOOM ]) {_state = STATE.ZOOM; } 
//else if ( event.keyCode === _this.keys[ STATE.PAN ]) {_state = STATE.PAN;}

}
function keyup( event ) {

		_state =STATE.NONE;
}

function mousedown( event ) {

	if ( _state === STATE.NONE ) {_state = event.button;}

	if ( _state === STATE.ROTATE) {
		_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );
		_movePrev.copy( _moveCurr );
	} 
	else if ( _state === STATE.ZOOM) {
		_zoomStart.copy( getMouseOnScreen( event.pageX, event.pageY ) );
		_zoomEnd.copy( _zoomStart );
	} 
	else if ( _state === STATE.PAN) {
		_panStart.copy( getMouseOnScreen( event.pageX, event.pageY ) );
		_panEnd.copy( _panStart );
	}

	document.addEventListener( 'mousemove', mousemove, false );
	document.addEventListener( 'mouseup', mouseup, false );

	//_this.dispatchEvent( startEvent );

}

function mousemove( event ) {
	if ( _state === STATE.ROTATE) {

		_movePrev.copy( _moveCurr );
		_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );

	} else if ( _state === STATE.ZOOM) {

		_zoomEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

	} else if ( _state === STATE.PAN) {

		_panEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

	}

}

function mouseup( event ) {

	_state = STATE.NONE;

}

function mousewheel( event ) {

	event.preventDefault();
	switch ( event.deltaMode ) {

		case 2:
			// Zoom in pages
			_zoomStart.y -= event.deltaY * 0.025;
			break;

		case 1:
			// Zoom in lines
			_zoomStart.y -= event.deltaY * 0.01;
			break;

		default:
			// undefined, 0, assume pixels
			_zoomStart.y -= event.deltaY * 0.00025;
			break;

	}

}
function contextmenu( event ) {
	event.preventDefault();

}
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
		this.rotateCamera = ( function() {

		var axis = new THREE.Vector3(),
			quaternion = new THREE.Quaternion(),
			eyeDirection = new THREE.Vector3(),
			objectUpDirection = new THREE.Vector3(),
			objectSidewaysDirection = new THREE.Vector3(),
			moveDirection = new THREE.Vector3(),
			angle;

		return function rotateCamera() {

			moveDirection.set( _moveCurr.x - _movePrev.x, _moveCurr.y - _movePrev.y, 0 );
			angle = moveDirection.length();

			if ( angle ) {

				_eye.copy( _this.object.position ).sub( _this.target );

				eyeDirection.copy( _eye ).normalize();
				objectUpDirection.copy( _this.object.up ).normalize();
				objectSidewaysDirection.crossVectors( objectUpDirection, eyeDirection ).normalize();

				objectUpDirection.setLength( _moveCurr.y - _movePrev.y );
				objectSidewaysDirection.setLength( _moveCurr.x - _movePrev.x );

				moveDirection.copy( objectUpDirection.add( objectSidewaysDirection ) );

				axis.crossVectors( moveDirection, _eye ).normalize();

				angle *= _this.rotateSpeed/Math.min(Math.max(_eye.length()/200,0.2),5);//added factor depending on distance from axis, otherwise seeing things farther from the axis becomes hard
				quaternion.setFromAxisAngle( axis, angle );

				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

				_lastAxis.copy( axis );
				_lastAngle = angle;

			} else if ( ! _this.staticMoving && _lastAngle ) {

				_lastAngle *= Math.sqrt( 1.0 - _this.dynamicDampingFactor );
				_eye.copy( _this.object.position ).sub( _this.target );
				quaternion.setFromAxisAngle( _lastAxis, _lastAngle );
				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

			}

			_movePrev.copy( _moveCurr );

		};

	}() );


	this.zoomCamera = function () {

		var factor;

		if ( _state === STATE.TOUCH_ZOOM_PAN ) {

			factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
			_touchZoomDistanceStart = _touchZoomDistanceEnd;
			_eye.multiplyScalar( factor );

		} else {

			factor = 1.0 + ( _zoomEnd.y - _zoomStart.y ) * _this.zoomSpeed;

			if ( factor !== 1.0 && factor > 0.0 ) {

				_eye.multiplyScalar( factor );

			}

			if ( _this.staticMoving ) {

				_zoomStart.copy( _zoomEnd );

			} else {

				_zoomStart.y += ( _zoomEnd.y - _zoomStart.y ) * this.dynamicDampingFactor;

			}

		}

	};

	this.panCamera = ( function() {

		var mouseChange = new THREE.Vector2(),
			objectUp = new THREE.Vector3(),
			pan = new THREE.Vector3();

		return function panCamera() {

			mouseChange.copy( _panEnd ).sub( _panStart );

			if ( mouseChange.lengthSq() ) {

				mouseChange.multiplyScalar( _eye.length() * _this.panSpeed );

				pan.copy( _eye ).cross( _this.object.up ).setLength( mouseChange.x );
				pan.add( objectUp.copy( _this.object.up ).setLength( mouseChange.y ) );

				_this.object.position.add( pan );
				_this.target.add( pan );

				if ( _this.staticMoving ) {

					_panStart.copy( _panEnd );

				} else {

					_panStart.add( mouseChange.subVectors( _panEnd, _panStart ).multiplyScalar( _this.dynamicDampingFactor ) );

				}

			}

		};

	}() );
	this.handleResize=function() {

		if (domElement === document ) {

			screen.left = 0;
			screen.top = 0;
			screen.width = window.innerWidth;
			screen.height = window.innerHeight;

		} else {

			var box = domElement.getBoundingClientRect();
			// adjustments come from similar code in the jquery offset() function
			var d = domElement.ownerDocument.documentElement;
			this.screen.left = box.left + window.pageXOffset - d.clientLeft;
			this.screen.top = box.top + window.pageYOffset - d.clientTop;
			this.screen.width = box.width;
			this.screen.height = box.height;

		}

	}
	
		var getMouseOnScreen = ( function () {

		var vector = new THREE.Vector2();

		return function getMouseOnScreen( pageX, pageY ) {

			vector.set(
				( pageX - _this.screen.left ) / _this.screen.width,
				( pageY - _this.screen.top ) / _this.screen.height
			);

			return vector;

		};

	}() );

	var getMouseOnCircle = ( function () {

		var vector = new THREE.Vector2();

		return function getMouseOnCircle( pageX, pageY ) {

			vector.set(
				( ( pageX - _this.screen.width * 0.5 - _this.screen.left ) / ( _this.screen.width * 0.5 ) ),
				( ( _this.screen.height + 2 * ( _this.screen.top - pageY ) ) / _this.screen.width ) // screen.width intentional
			);

			return vector;

		};

	}() );



	this.checkDistances = function () {

		if ( ! _this.noZoom || ! _this.noPan ) {

			if ( _eye.lengthSq() > _this.maxDistance * _this.maxDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.maxDistance ) );
				_zoomStart.copy( _zoomEnd );

			}

			if ( _eye.lengthSq() < _this.minDistance * _this.minDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.minDistance ) );
				_zoomStart.copy( _zoomEnd );

			}

		}

	};

	this.update = function () {

		_eye.subVectors( _this.object.position, _this.target );
		_this.rotateCamera();
		_this.zoomCamera();
		_this.panCamera();

		_this.object.position.addVectors( _this.target, _eye );
		_this.checkDistances();
		_this.object.lookAt( _this.target );

		//if ( lastPosition.distanceToSquared( _this.object.position ) > EPS ) {
		//	_this.dispatchEvent( changeEvent );
		//	lastPosition.copy( _this.object.position );
		//}

	};
	this.reset = function () {
		_this.target.copy( _this.target0 );
		_this.object.position.copy( _this.position0 );
		_this.object.up.copy( _this.up0 );

		_eye.subVectors( _this.object.position, _this.target );

		_this.object.lookAt( _this.target );

		_this.dispatchEvent( changeEvent );

		lastPosition.copy( _this.object.position );

	};

	
	domElement.addEventListener( 'contextmenu', contextmenu, false );
	domElement.addEventListener( 'mousedown', mousedown, false );
	domElement.addEventListener( 'wheel', mousewheel, false );
	
	window.addEventListener( 'keydown', keydown, false );
	window.addEventListener( 'keyup', keyup, false );
	this.handleResize();
	this.update();
	
}









	
	
	
