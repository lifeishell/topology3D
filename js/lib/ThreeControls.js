define(['three'], function (THREE) {
    /**
     * @author qiao / https://github.com/qiao
     * @author mrdoob / http://mrdoob.com
     * @author alteredq / http://alteredqualia.com/
     * @author WestLangley / http://github.com/WestLangley
     * @author erich666 / http://erichaines.com
     */

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finger swipe

    THREE.OrbitControls = function (object, domElement) {

        this.object = object;

        this.domElement = ( domElement !== undefined ) ? domElement : document;

        // Set to false to disable this control
        this.enabled = true;

        // "target" sets the location of focus, where the object orbits around
        this.target = new THREE.Vector3();

        // How far you can dolly in and out ( PerspectiveCamera only )
        this.minDistance = 0;
        this.maxDistance = Infinity;

        // How far you can zoom in and out ( OrthographicCamera only )
        this.minZoom = 0;
        this.maxZoom = Infinity;

        // How far you can orbit vertically, upper and lower limits.
        // Range is 0 to Math.PI radians.
        this.minPolarAngle = 0; // radians
        this.maxPolarAngle = Math.PI; // radians

        // How far you can orbit horizontally, upper and lower limits.
        // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
        this.minAzimuthAngle = -Infinity; // radians
        this.maxAzimuthAngle = Infinity; // radians

        // Set to true to enable damping (inertia)
        // If damping is enabled, you must call controls.update() in your animation loop
        this.enableDamping = false;
        this.dampingFactor = 0.25;

        // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
        // Set to false to disable zooming
        this.enableZoom = true;
        this.zoomSpeed = 1.0;

        // Set to false to disable rotating
        this.enableRotate = true;
        this.rotateSpeed = 1.0;

        // Set to false to disable panning
        this.enablePan = true;
        this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

        // Set to true to automatically rotate around the target
        // If auto-rotate is enabled, you must call controls.update() in your animation loop
        this.autoRotate = false;
        this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

        // Set to false to disable use of the keys
        this.enableKeys = true;

        // The four arrow keys
        this.keys = {LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40};

        // Mouse buttons
        this.mouseButtons = {ORBIT: THREE.MOUSE.LEFT, ZOOM: THREE.MOUSE.MIDDLE, PAN: THREE.MOUSE.RIGHT};

        // for reset
        this.target0 = this.target.clone();
        this.position0 = this.object.position.clone();
        this.zoom0 = this.object.zoom;

        //
        // public methods
        //

        this.getPolarAngle = function () {

            return spherical.phi;

        };

        this.getAzimuthalAngle = function () {

            return spherical.theta;

        };

        this.reset = function () {

            scope.target.copy(scope.target0);
            scope.object.position.copy(scope.position0);
            scope.object.zoom = scope.zoom0;

            scope.object.updateProjectionMatrix();
            scope.dispatchEvent(changeEvent);

            scope.update();

            state = STATE.NONE;

        };

        // this method is exposed, but perhaps it would be better if we can make it private...
        this.update = function () {

            var offset = new THREE.Vector3();

            // so camera.up is the orbit axis
            var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
            var quatInverse = quat.clone().inverse();

            var lastPosition = new THREE.Vector3();
            var lastQuaternion = new THREE.Quaternion();

            return function update() {

                var position = scope.object.position;

                offset.copy(position).sub(scope.target);

                // rotate offset to "y-axis-is-up" space
                offset.applyQuaternion(quat);

                // angle from z-axis around y-axis
                spherical.setFromVector3(offset);

                if (scope.autoRotate && state === STATE.NONE) {

                    rotateLeft(getAutoRotationAngle());

                }

                spherical.theta += sphericalDelta.theta;
                spherical.phi += sphericalDelta.phi;

                // restrict theta to be between desired limits
                spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));

                // restrict phi to be between desired limits
                spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));

                spherical.makeSafe();


                spherical.radius *= scale;

                // restrict radius to be between desired limits
                spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

                // move target to panned location
                scope.target.add(panOffset);

                offset.setFromSpherical(spherical);

                // rotate offset back to "camera-up-vector-is-up" space
                offset.applyQuaternion(quatInverse);

                position.copy(scope.target).add(offset);

                scope.object.lookAt(scope.target);

                if (scope.enableDamping === true) {

                    sphericalDelta.theta *= ( 1 - scope.dampingFactor );
                    sphericalDelta.phi *= ( 1 - scope.dampingFactor );

                } else {

                    sphericalDelta.set(0, 0, 0);

                }

                scale = 1;
                panOffset.set(0, 0, 0);

                // update condition is:
                // min(camera displacement, camera rotation in radians)^2 > EPS
                // using small-angle approximation cos(x/2) = 1 - x^2 / 8

                if (zoomChanged ||
                    lastPosition.distanceToSquared(scope.object.position) > EPS ||
                    8 * ( 1 - lastQuaternion.dot(scope.object.quaternion) ) > EPS) {

                    scope.dispatchEvent(changeEvent);

                    lastPosition.copy(scope.object.position);
                    lastQuaternion.copy(scope.object.quaternion);
                    zoomChanged = false;

                    return true;

                }

                return false;

            };

        }();

        this.dispose = function () {

            scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
            scope.domElement.removeEventListener('mousedown', onMouseDown, false);
            scope.domElement.removeEventListener('wheel', onMouseWheel, false);

            scope.domElement.removeEventListener('touchstart', onTouchStart, false);
            scope.domElement.removeEventListener('touchend', onTouchEnd, false);
            scope.domElement.removeEventListener('touchmove', onTouchMove, false);

            document.removeEventListener('mousemove', onMouseMove, false);
            document.removeEventListener('mouseup', onMouseUp, false);

            window.removeEventListener('keydown', onKeyDown, false);

            //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

        };

        //
        // internals
        //

        var scope = this;

        var changeEvent = {type: 'change'};
        var startEvent = {type: 'start'};
        var endEvent = {type: 'end'};

        var STATE = {NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY: 4, TOUCH_PAN: 5};

        var state = STATE.NONE;

        var EPS = 0.000001;

        // current position in spherical coordinates
        var spherical = new THREE.Spherical();
        var sphericalDelta = new THREE.Spherical();

        var scale = 1;
        var panOffset = new THREE.Vector3();
        var zoomChanged = false;

        var rotateStart = new THREE.Vector2();
        var rotateEnd = new THREE.Vector2();
        var rotateDelta = new THREE.Vector2();

        var panStart = new THREE.Vector2();
        var panEnd = new THREE.Vector2();
        var panDelta = new THREE.Vector2();

        var dollyStart = new THREE.Vector2();
        var dollyEnd = new THREE.Vector2();
        var dollyDelta = new THREE.Vector2();

        function getAutoRotationAngle() {

            return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

        }

        function getZoomScale() {

            return Math.pow(0.95, scope.zoomSpeed);

        }

        function rotateLeft(angle) {

            sphericalDelta.theta -= angle;

        }

        function rotateUp(angle) {

            sphericalDelta.phi -= angle;

        }

        var panLeft = function () {

            var v = new THREE.Vector3();

            return function panLeft(distance, objectMatrix) {

                v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
                v.multiplyScalar(-distance);

                panOffset.add(v);

            };

        }();

        var panUp = function () {

            var v = new THREE.Vector3();

            return function panUp(distance, objectMatrix) {

                v.setFromMatrixColumn(objectMatrix, 1); // get Y column of objectMatrix
                v.multiplyScalar(distance);

                panOffset.add(v);

            };

        }();

        // deltaX and deltaY are in pixels; right and down are positive
        var pan = function () {

            var offset = new THREE.Vector3();

            return function pan(deltaX, deltaY) {

                var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                if (scope.object instanceof THREE.PerspectiveCamera) {

                    // perspective
                    var position = scope.object.position;
                    offset.copy(position).sub(scope.target);
                    var targetDistance = offset.length();

                    // half of the fov is center to top of screen
                    targetDistance *= Math.tan(( scope.object.fov / 2 ) * Math.PI / 180.0);

                    // we actually don't use screenWidth, since perspective camera is fixed to screen height
                    panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
                    panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);

                } else if (scope.object instanceof THREE.OrthographicCamera) {

                    // orthographic
                    panLeft(deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix);
                    panUp(deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix);

                } else {

                    // camera neither orthographic nor perspective
                    console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
                    scope.enablePan = false;

                }

            };

        }();

        function dollyIn(dollyScale) {

            if (scope.object instanceof THREE.PerspectiveCamera) {

                scale /= dollyScale;

            } else if (scope.object instanceof THREE.OrthographicCamera) {

                scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
                scope.object.updateProjectionMatrix();
                zoomChanged = true;

            } else {

                console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
                scope.enableZoom = false;

            }

        }

        function dollyOut(dollyScale) {

            if (scope.object instanceof THREE.PerspectiveCamera) {

                scale *= dollyScale;

            } else if (scope.object instanceof THREE.OrthographicCamera) {

                scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
                scope.object.updateProjectionMatrix();
                zoomChanged = true;

            } else {

                console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
                scope.enableZoom = false;

            }

        }

        //
        // event callbacks - update the object state
        //

        function handleMouseDownRotate(event) {

            //console.log( 'handleMouseDownRotate' );

            rotateStart.set(event.clientX, event.clientY);

        }

        function handleMouseDownDolly(event) {

            //console.log( 'handleMouseDownDolly' );

            dollyStart.set(event.clientX, event.clientY);

        }

        function handleMouseDownPan(event) {

            //console.log( 'handleMouseDownPan' );

            panStart.set(event.clientX, event.clientY);

        }

        function handleMouseMoveRotate(event) {

            //console.log( 'handleMouseMoveRotate' );

            rotateEnd.set(event.clientX, event.clientY);
            rotateDelta.subVectors(rotateEnd, rotateStart);

            var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

            // rotating across whole screen goes 360 degrees around
            rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed);

            // rotating up and down along whole screen attempts to go 360, but limited to 180
            rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

            rotateStart.copy(rotateEnd);

            scope.update();

        }

        function handleMouseMoveDolly(event) {

            //console.log( 'handleMouseMoveDolly' );

            dollyEnd.set(event.clientX, event.clientY);

            dollyDelta.subVectors(dollyEnd, dollyStart);

            if (dollyDelta.y > 0) {

                dollyIn(getZoomScale());

            } else if (dollyDelta.y < 0) {

                dollyOut(getZoomScale());

            }

            dollyStart.copy(dollyEnd);

            scope.update();

        }

        function handleMouseMovePan(event) {

            //console.log( 'handleMouseMovePan' );

            panEnd.set(event.clientX, event.clientY);

            panDelta.subVectors(panEnd, panStart);

            pan(panDelta.x, panDelta.y);

            panStart.copy(panEnd);

            scope.update();

        }

        function handleMouseUp(event) {

            // console.log( 'handleMouseUp' );

        }

        function handleMouseWheel(event) {

            // console.log( 'handleMouseWheel' );

            if (event.deltaY < 0) {

                dollyOut(getZoomScale());

            } else if (event.deltaY > 0) {

                dollyIn(getZoomScale());

            }

            scope.update();

        }

        function handleKeyDown(event) {

            //console.log( 'handleKeyDown' );

            switch (event.keyCode) {

                case scope.keys.UP:
                    pan(0, scope.keyPanSpeed);
                    scope.update();
                    break;

                case scope.keys.BOTTOM:
                    pan(0, -scope.keyPanSpeed);
                    scope.update();
                    break;

                case scope.keys.LEFT:
                    pan(scope.keyPanSpeed, 0);
                    scope.update();
                    break;

                case scope.keys.RIGHT:
                    pan(-scope.keyPanSpeed, 0);
                    scope.update();
                    break;

            }

        }

        function handleTouchStartRotate(event) {

            //console.log( 'handleTouchStartRotate' );

            rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);

        }

        function handleTouchStartDolly(event) {

            //console.log( 'handleTouchStartDolly' );

            var dx = event.touches[0].pageX - event.touches[1].pageX;
            var dy = event.touches[0].pageY - event.touches[1].pageY;

            var distance = Math.sqrt(dx * dx + dy * dy);

            dollyStart.set(0, distance);

        }

        function handleTouchStartPan(event) {

            //console.log( 'handleTouchStartPan' );

            panStart.set(event.touches[0].pageX, event.touches[0].pageY);

        }

        function handleTouchMoveRotate(event) {

            //console.log( 'handleTouchMoveRotate' );

            rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
            rotateDelta.subVectors(rotateEnd, rotateStart);

            var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

            // rotating across whole screen goes 360 degrees around
            rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed);

            // rotating up and down along whole screen attempts to go 360, but limited to 180
            rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

            rotateStart.copy(rotateEnd);

            scope.update();

        }

        function handleTouchMoveDolly(event) {

            //console.log( 'handleTouchMoveDolly' );

            var dx = event.touches[0].pageX - event.touches[1].pageX;
            var dy = event.touches[0].pageY - event.touches[1].pageY;

            var distance = Math.sqrt(dx * dx + dy * dy);

            dollyEnd.set(0, distance);

            dollyDelta.subVectors(dollyEnd, dollyStart);

            if (dollyDelta.y > 0) {

                dollyOut(getZoomScale());

            } else if (dollyDelta.y < 0) {

                dollyIn(getZoomScale());

            }

            dollyStart.copy(dollyEnd);

            scope.update();

        }

        function handleTouchMovePan(event) {

            //console.log( 'handleTouchMovePan' );

            panEnd.set(event.touches[0].pageX, event.touches[0].pageY);

            panDelta.subVectors(panEnd, panStart);

            pan(panDelta.x, panDelta.y);

            panStart.copy(panEnd);

            scope.update();

        }

        function handleTouchEnd(event) {

            //console.log( 'handleTouchEnd' );

        }

        //
        // event handlers - FSM: listen for events and reset state
        //

        function onMouseDown(event) {

            if (scope.enabled === false) return;

            event.preventDefault();

            if (event.button === scope.mouseButtons.ORBIT) {

                if (scope.enableRotate === false) return;

                handleMouseDownRotate(event);

                state = STATE.ROTATE;

            } else if (event.button === scope.mouseButtons.ZOOM) {

                if (scope.enableZoom === false) return;

                handleMouseDownDolly(event);

                state = STATE.DOLLY;

            } else if (event.button === scope.mouseButtons.PAN) {

                if (scope.enablePan === false) return;

                handleMouseDownPan(event);

                state = STATE.PAN;

            }

            if (state !== STATE.NONE) {

                document.addEventListener('mousemove', onMouseMove, false);
                document.addEventListener('mouseup', onMouseUp, false);

                scope.dispatchEvent(startEvent);

            }

        }

        function onMouseMove(event) {

            if (scope.enabled === false) return;

            event.preventDefault();

            if (state === STATE.ROTATE) {

                if (scope.enableRotate === false) return;

                handleMouseMoveRotate(event);

            } else if (state === STATE.DOLLY) {

                if (scope.enableZoom === false) return;

                handleMouseMoveDolly(event);

            } else if (state === STATE.PAN) {

                if (scope.enablePan === false) return;

                handleMouseMovePan(event);

            }

        }

        function onMouseUp(event) {

            if (scope.enabled === false) return;

            handleMouseUp(event);

            document.removeEventListener('mousemove', onMouseMove, false);
            document.removeEventListener('mouseup', onMouseUp, false);

            scope.dispatchEvent(endEvent);

            state = STATE.NONE;

        }

        function onMouseWheel(event) {

            if (scope.enabled === false || scope.enableZoom === false || ( state !== STATE.NONE && state !== STATE.ROTATE )) return;

            event.preventDefault();
            event.stopPropagation();

            handleMouseWheel(event);

            scope.dispatchEvent(startEvent); // not sure why these are here...
            scope.dispatchEvent(endEvent);

        }

        function onKeyDown(event) {

            if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) return;

            handleKeyDown(event);

        }

        function onTouchStart(event) {

            if (scope.enabled === false) return;

            switch (event.touches.length) {

                case 1:	// one-fingered touch: rotate

                    if (scope.enableRotate === false) return;

                    handleTouchStartRotate(event);

                    state = STATE.TOUCH_ROTATE;

                    break;

                case 2:	// two-fingered touch: dolly

                    if (scope.enableZoom === false) return;

                    handleTouchStartDolly(event);

                    state = STATE.TOUCH_DOLLY;

                    break;

                case 3: // three-fingered touch: pan

                    if (scope.enablePan === false) return;

                    handleTouchStartPan(event);

                    state = STATE.TOUCH_PAN;

                    break;

                default:

                    state = STATE.NONE;

            }

            if (state !== STATE.NONE) {

                scope.dispatchEvent(startEvent);

            }

        }

        function onTouchMove(event) {

            if (scope.enabled === false) return;

            event.preventDefault();
            event.stopPropagation();

            switch (event.touches.length) {

                case 1: // one-fingered touch: rotate

                    if (scope.enableRotate === false) return;
                    if (state !== STATE.TOUCH_ROTATE) return; // is this needed?...

                    handleTouchMoveRotate(event);

                    break;

                case 2: // two-fingered touch: dolly

                    if (scope.enableZoom === false) return;
                    if (state !== STATE.TOUCH_DOLLY) return; // is this needed?...

                    handleTouchMoveDolly(event);

                    break;

                case 3: // three-fingered touch: pan

                    if (scope.enablePan === false) return;
                    if (state !== STATE.TOUCH_PAN) return; // is this needed?...

                    handleTouchMovePan(event);

                    break;

                default:

                    state = STATE.NONE;

            }

        }

        function onTouchEnd(event) {

            if (scope.enabled === false) return;

            handleTouchEnd(event);

            scope.dispatchEvent(endEvent);

            state = STATE.NONE;

        }

        function onContextMenu(event) {

            event.preventDefault();

        }

        //

        scope.domElement.addEventListener('contextmenu', onContextMenu, false);

        scope.domElement.addEventListener('mousedown', onMouseDown, false);
        scope.domElement.addEventListener('wheel', onMouseWheel, false);

        scope.domElement.addEventListener('touchstart', onTouchStart, false);
        scope.domElement.addEventListener('touchend', onTouchEnd, false);
        scope.domElement.addEventListener('touchmove', onTouchMove, false);

        window.addEventListener('keydown', onKeyDown, false);

        // force an update at start

        this.update();

    };

    THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
    THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

    Object.defineProperties(THREE.OrbitControls.prototype, {

        center: {

            get: function () {

                console.warn('THREE.OrbitControls: .center has been renamed to .target');
                return this.target;

            }

        },

        // backward compatibility

        noZoom: {

            get: function () {

                console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
                return !this.enableZoom;

            },

            set: function (value) {

                console.warn('THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.');
                this.enableZoom = !value;

            }

        },

        noRotate: {

            get: function () {

                console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
                return !this.enableRotate;

            },

            set: function (value) {

                console.warn('THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.');
                this.enableRotate = !value;

            }

        },

        noPan: {

            get: function () {

                console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
                return !this.enablePan;

            },

            set: function (value) {

                console.warn('THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.');
                this.enablePan = !value;

            }

        },

        noKeys: {

            get: function () {

                console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
                return !this.enableKeys;

            },

            set: function (value) {

                console.warn('THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.');
                this.enableKeys = !value;

            }

        },

        staticMoving: {

            get: function () {

                console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
                return !this.enableDamping;

            },

            set: function (value) {

                console.warn('THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.');
                this.enableDamping = !value;

            }

        },

        dynamicDampingFactor: {

            get: function () {

                console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
                return this.dampingFactor;

            },

            set: function (value) {

                console.warn('THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.');
                this.dampingFactor = value;

            }

        }

    });

    /*
     * @author zz85 / https://github.com/zz85
     * @author mrdoob / http://mrdoob.com
     * Running this will allow you to drag three.js objects around the screen.
     */

    THREE.DragControls = function ( _objects, _camera, _domElement ) {

        if ( _objects instanceof THREE.Camera ) {

            console.warn( 'THREE.DragControls: Constructor now expects ( objects, camera, domElement )' );
            var temp = _objects; _objects = _camera; _camera = temp;

        }

        var _plane = new THREE.Plane();
        var _raycaster = new THREE.Raycaster();

        var _mouse = new THREE.Vector2();
        var _offset = new THREE.Vector3();
        var _intersection = new THREE.Vector3();

        var _selected = null, _hovered = null;

        //

        var scope = this;

        function activate() {

            _domElement.addEventListener( 'mousemove', onDocumentMouseMove, false );
            _domElement.addEventListener( 'mousedown', onDocumentMouseDown, false );
            _domElement.addEventListener( 'mouseup', onDocumentMouseUp, false );

        }

        function deactivate() {

            _domElement.removeEventListener( 'mousemove', onDocumentMouseMove, false );
            _domElement.removeEventListener( 'mousedown', onDocumentMouseDown, false );
            _domElement.removeEventListener( 'mouseup', onDocumentMouseUp, false );

        }

        function dispose() {

            deactivate();

        }

        function onDocumentMouseMove( event ) {

            event.preventDefault();

            _mouse.x = ( event.clientX / _domElement.width ) * 2 - 1;
            _mouse.y = - ( event.clientY / _domElement.height ) * 2 + 1;

            _raycaster.setFromCamera( _mouse, _camera );

            if ( _selected && scope.enabled ) {

                if ( _raycaster.ray.intersectPlane( _plane, _intersection ) ) {

                    _selected.position.copy( _intersection.sub( _offset ) );

                }

                scope.dispatchEvent( { type: 'drag', object: _selected } );

                return;

            }

            _raycaster.setFromCamera( _mouse, _camera );

            var intersects = _raycaster.intersectObjects( _objects );

            if ( intersects.length > 0 ) {

                var object = intersects[ 0 ].object;

                _plane.setFromNormalAndCoplanarPoint( _camera.getWorldDirection( _plane.normal ), object.position );

                if ( _hovered !== object ) {

                    scope.dispatchEvent( { type: 'hoveron', object: object } );

                    _domElement.style.cursor = 'pointer';
                    _hovered = object;

                }

            } else {

                if ( _hovered !== null ) {

                    scope.dispatchEvent( { type: 'hoveroff', object: _hovered } );

                    _domElement.style.cursor = 'auto';
                    _hovered = null;

                }

            }

        }

        function onDocumentMouseDown( event ) {

            event.preventDefault();

            _raycaster.setFromCamera( _mouse, _camera );

            var intersects = _raycaster.intersectObjects( _objects );

            if ( intersects.length > 0 ) {

                _selected = intersects[ 0 ].object;

                if ( _raycaster.ray.intersectPlane( _plane, _intersection ) ) {

                    _offset.copy( _intersection ).sub( _selected.position );

                }

                _domElement.style.cursor = 'move';

                scope.dispatchEvent( { type: 'dragstart', object: _selected } );

            }


        }

        function onDocumentMouseUp( event ) {

            event.preventDefault();

            if ( _selected ) {

                scope.dispatchEvent( { type: 'dragend', object: _selected } );

                _selected = null;

            }

            _domElement.style.cursor = 'auto';

        }

        activate();

        // API

        this.enabled = true;

        this.activate = activate;
        this.deactivate = deactivate;
        this.dispose = dispose;

        // Backward compatibility

        this.setObjects = function () {

            console.error( 'THREE.DragControls: setObjects() has been removed.' );

        };

        this.on = function ( type, listener ) {

            console.warn( 'THREE.DragControls: on() has been deprecated. Use addEventListener() instead.' );
            scope.addEventListener( type, listener );

        };

        this.off = function ( type, listener ) {

            console.warn( 'THREE.DragControls: off() has been deprecated. Use removeEventListener() instead.' );
            scope.removeEventListener( type, listener );

        };

        this.notify = function ( type ) {

            console.error( 'THREE.DragControls: notify() has been deprecated. Use dispatchEvent() instead.' );
            scope.dispatchEvent( { type: type } );

        };

    };

    THREE.DragControls.prototype = Object.create( THREE.EventDispatcher.prototype );
    THREE.DragControls.prototype.constructor = THREE.DragControls;

   var GizmoMaterial = function ( parameters ) {

        THREE.MeshBasicMaterial.call( this );

        this.depthTest = false;
        this.depthWrite = false;
        this.side = THREE.FrontSide;
        this.transparent = true;

        this.setValues( parameters );

        this.oldColor = this.color.clone();
        this.oldOpacity = this.opacity;

        this.highlight = function( highlighted ) {

            if ( highlighted ) {

                this.color.setRGB( 1, 1, 0 );
                this.opacity = 1;

            } else {

                this.color.copy( this.oldColor );
                this.opacity = this.oldOpacity;

            }

        };

    };

    GizmoMaterial.prototype = Object.create( THREE.MeshBasicMaterial.prototype );
    GizmoMaterial.prototype.constructor = GizmoMaterial;


    var GizmoLineMaterial = function ( parameters ) {

        THREE.LineBasicMaterial.call( this );

        this.depthTest = false;
        this.depthWrite = false;
        this.transparent = true;
        this.linewidth = 1;

        this.setValues( parameters );

        this.oldColor = this.color.clone();
        this.oldOpacity = this.opacity;

        this.highlight = function( highlighted ) {

            if ( highlighted ) {

                this.color.setRGB( 1, 1, 0 );
                this.opacity = 1;

            } else {

                this.color.copy( this.oldColor );
                this.opacity = this.oldOpacity;

            }

        };

    };

    GizmoLineMaterial.prototype = Object.create( THREE.LineBasicMaterial.prototype );
    GizmoLineMaterial.prototype.constructor = GizmoLineMaterial;


    var pickerMaterial = new GizmoMaterial( { visible: false, transparent: false } );


    THREE.TransformGizmo = function () {

        var scope = this;

        this.init = function () {

            THREE.Object3D.call( this );

            this.handles = new THREE.Object3D();
            this.pickers = new THREE.Object3D();
            this.planes = new THREE.Object3D();

            this.add( this.handles );
            this.add( this.pickers );
            this.add( this.planes );

            //// PLANES

            var planeGeometry = new THREE.PlaneBufferGeometry( 50, 50, 2, 2 );
            var planeMaterial = new THREE.MeshBasicMaterial( { visible: false, side: THREE.DoubleSide } );

            var planes = {
                "XY":   new THREE.Mesh( planeGeometry, planeMaterial ),
                "YZ":   new THREE.Mesh( planeGeometry, planeMaterial ),
                "XZ":   new THREE.Mesh( planeGeometry, planeMaterial ),
                "XYZE": new THREE.Mesh( planeGeometry, planeMaterial )
            };

            this.activePlane = planes[ "XYZE" ];

            planes[ "YZ" ].rotation.set( 0, Math.PI / 2, 0 );
            planes[ "XZ" ].rotation.set( - Math.PI / 2, 0, 0 );

            for ( var i in planes ) {

                planes[ i ].name = i;
                this.planes.add( planes[ i ] );
                this.planes[ i ] = planes[ i ];

            }

            //// HANDLES AND PICKERS

            var setupGizmos = function( gizmoMap, parent ) {

                for ( var name in gizmoMap ) {

                    for ( i = gizmoMap[ name ].length; i --; ) {

                        var object = gizmoMap[ name ][ i ][ 0 ];
                        var position = gizmoMap[ name ][ i ][ 1 ];
                        var rotation = gizmoMap[ name ][ i ][ 2 ];

                        object.name = name;

                        if ( position ) object.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );
                        if ( rotation ) object.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );

                        parent.add( object );

                    }

                }

            };

            setupGizmos( this.handleGizmos, this.handles );
            setupGizmos( this.pickerGizmos, this.pickers );

            // reset Transformations

            this.traverse( function ( child ) {

                if ( child instanceof THREE.Mesh ) {

                    child.updateMatrix();

                    var tempGeometry = child.geometry.clone();
                    tempGeometry.applyMatrix( child.matrix );
                    child.geometry = tempGeometry;

                    child.position.set( 0, 0, 0 );
                    child.rotation.set( 0, 0, 0 );
                    child.scale.set( 1, 1, 1 );

                }

            } );

        };

        this.highlight = function ( axis ) {

            this.traverse( function( child ) {

                if ( child.material && child.material.highlight ) {

                    if ( child.name === axis ) {

                        child.material.highlight( true );

                    } else {

                        child.material.highlight( false );

                    }

                }

            } );

        };

    };

    THREE.TransformGizmo.prototype = Object.create( THREE.Object3D.prototype );
    THREE.TransformGizmo.prototype.constructor = THREE.TransformGizmo;

    THREE.TransformGizmo.prototype.update = function ( rotation, eye ) {

        var vec1 = new THREE.Vector3( 0, 0, 0 );
        var vec2 = new THREE.Vector3( 0, 1, 0 );
        var lookAtMatrix = new THREE.Matrix4();

        this.traverse( function( child ) {

            if ( child.name.search( "E" ) !== - 1 ) {

                child.quaternion.setFromRotationMatrix( lookAtMatrix.lookAt( eye, vec1, vec2 ) );

            } else if ( child.name.search( "X" ) !== - 1 || child.name.search( "Y" ) !== - 1 || child.name.search( "Z" ) !== - 1 ) {

                child.quaternion.setFromEuler( rotation );

            }

        } );

    };

    THREE.TransformGizmoTranslate = function () {

        THREE.TransformGizmo.call( this );

        var arrowGeometry = new THREE.Geometry();
        var mesh = new THREE.Mesh( new THREE.CylinderGeometry( 0, 0.05, 0.2, 12, 1, false ) );
        mesh.position.y = 0.5;
        mesh.updateMatrix();

        arrowGeometry.merge( mesh.geometry, mesh.matrix );

        var lineXGeometry = new THREE.BufferGeometry();
        lineXGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  1, 0, 0 ], 3 ) );

        var lineYGeometry = new THREE.BufferGeometry();
        lineYGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 1, 0 ], 3 ) );

        var lineZGeometry = new THREE.BufferGeometry();
        lineZGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 0, 1 ], 3 ) );

        this.handleGizmos = {

            X: [
                [ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: 0xff0000 } ) ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
                [ new THREE.Line( lineXGeometry, new GizmoLineMaterial( { color: 0xff0000 } ) ) ]
            ],

            Y: [
                [ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: 0x00ff00 } ) ), [ 0, 0.5, 0 ] ],
                [	new THREE.Line( lineYGeometry, new GizmoLineMaterial( { color: 0x00ff00 } ) ) ]
            ],

            Z: [
                [ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: 0x0000ff } ) ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ] ],
                [ new THREE.Line( lineZGeometry, new GizmoLineMaterial( { color: 0x0000ff } ) ) ]
            ],

            XYZ: [
                [ new THREE.Mesh( new THREE.OctahedronGeometry( 0.1, 0 ), new GizmoMaterial( { color: 0xffffff, opacity: 0.25 } ) ), [ 0, 0, 0 ], [ 0, 0, 0 ] ]
            ],

            XY: [
                [ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.29, 0.29 ), new GizmoMaterial( { color: 0xffff00, opacity: 0.25 } ) ), [ 0.15, 0.15, 0 ] ]
            ],

            YZ: [
                [ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.29, 0.29 ), new GizmoMaterial( { color: 0x00ffff, opacity: 0.25 } ) ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ] ]
            ],

            XZ: [
                [ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.29, 0.29 ), new GizmoMaterial( { color: 0xff00ff, opacity: 0.25 } ) ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ] ]
            ]

        };

        this.pickerGizmos = {

            X: [
                [ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0.6, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ]
            ],

            Y: [
                [ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0.6, 0 ] ]
            ],

            Z: [
                [ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0, 0.6 ], [ Math.PI / 2, 0, 0 ] ]
            ],

            XYZ: [
                [ new THREE.Mesh( new THREE.OctahedronGeometry( 0.2, 0 ), pickerMaterial ) ]
            ],

            XY: [
                [ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.4, 0.4 ), pickerMaterial ), [ 0.2, 0.2, 0 ] ]
            ],

            YZ: [
                [ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.4, 0.4 ), pickerMaterial ), [ 0, 0.2, 0.2 ], [ 0, Math.PI / 2, 0 ] ]
            ],

            XZ: [
                [ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.4, 0.4 ), pickerMaterial ), [ 0.2, 0, 0.2 ], [ - Math.PI / 2, 0, 0 ] ]
            ]

        };

        this.setActivePlane = function ( axis, eye ) {

            var tempMatrix = new THREE.Matrix4();
            eye.applyMatrix4( tempMatrix.getInverse( tempMatrix.extractRotation( this.planes[ "XY" ].matrixWorld ) ) );

            if ( axis === "X" ) {

                this.activePlane = this.planes[ "XY" ];

                if ( Math.abs( eye.y ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "XZ" ];

            }

            if ( axis === "Y" ) {

                this.activePlane = this.planes[ "XY" ];

                if ( Math.abs( eye.x ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "YZ" ];

            }

            if ( axis === "Z" ) {

                this.activePlane = this.planes[ "XZ" ];

                if ( Math.abs( eye.x ) > Math.abs( eye.y ) ) this.activePlane = this.planes[ "YZ" ];

            }

            if ( axis === "XYZ" ) this.activePlane = this.planes[ "XYZE" ];

            if ( axis === "XY" ) this.activePlane = this.planes[ "XY" ];

            if ( axis === "YZ" ) this.activePlane = this.planes[ "YZ" ];

            if ( axis === "XZ" ) this.activePlane = this.planes[ "XZ" ];

        };

        this.init();

    };

    THREE.TransformGizmoTranslate.prototype = Object.create( THREE.TransformGizmo.prototype );
    THREE.TransformGizmoTranslate.prototype.constructor = THREE.TransformGizmoTranslate;

    THREE.TransformGizmoRotate = function () {

        THREE.TransformGizmo.call( this );

        var CircleGeometry = function ( radius, facing, arc ) {

            var geometry = new THREE.BufferGeometry();
            var vertices = [];
            arc = arc ? arc : 1;

            for ( var i = 0; i <= 64 * arc; ++ i ) {

                if ( facing === 'x' ) vertices.push( 0, Math.cos( i / 32 * Math.PI ) * radius, Math.sin( i / 32 * Math.PI ) * radius );
                if ( facing === 'y' ) vertices.push( Math.cos( i / 32 * Math.PI ) * radius, 0, Math.sin( i / 32 * Math.PI ) * radius );
                if ( facing === 'z' ) vertices.push( Math.sin( i / 32 * Math.PI ) * radius, Math.cos( i / 32 * Math.PI ) * radius, 0 );

            }

            geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
            return geometry;

        };

        this.handleGizmos = {

            X: [
                [ new THREE.Line( new CircleGeometry( 1, 'x', 0.5 ), new GizmoLineMaterial( { color: 0xff0000 } ) ) ]
            ],

            Y: [
                [ new THREE.Line( new CircleGeometry( 1, 'y', 0.5 ), new GizmoLineMaterial( { color: 0x00ff00 } ) ) ]
            ],

            Z: [
                [ new THREE.Line( new CircleGeometry( 1, 'z', 0.5 ), new GizmoLineMaterial( { color: 0x0000ff } ) ) ]
            ],

            E: [
                [ new THREE.Line( new CircleGeometry( 1.25, 'z', 1 ), new GizmoLineMaterial( { color: 0xcccc00 } ) ) ]
            ],

            XYZE: [
                [ new THREE.Line( new CircleGeometry( 1, 'z', 1 ), new GizmoLineMaterial( { color: 0x787878 } ) ) ]
            ]

        };

        this.pickerGizmos = {

            X: [
                [ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ] ]
            ],

            Y: [
                [ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ] ]
            ],

            Z: [
                [ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.12, 4, 12, Math.PI ), pickerMaterial ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ]
            ],

            E: [
                [ new THREE.Mesh( new THREE.TorusBufferGeometry( 1.25, 0.12, 2, 24 ), pickerMaterial ) ]
            ],

            XYZE: [
                [ new THREE.Mesh() ]// TODO
            ]

        };

        this.setActivePlane = function ( axis ) {

            if ( axis === "E" ) this.activePlane = this.planes[ "XYZE" ];

            if ( axis === "X" ) this.activePlane = this.planes[ "YZ" ];

            if ( axis === "Y" ) this.activePlane = this.planes[ "XZ" ];

            if ( axis === "Z" ) this.activePlane = this.planes[ "XY" ];

        };

        this.update = function ( rotation, eye2 ) {

            THREE.TransformGizmo.prototype.update.apply( this, arguments );

            var group = {

                handles: this[ "handles" ],
                pickers: this[ "pickers" ]

            };

            var tempMatrix = new THREE.Matrix4();
            var worldRotation = new THREE.Euler( 0, 0, 1 );
            var tempQuaternion = new THREE.Quaternion();
            var unitX = new THREE.Vector3( 1, 0, 0 );
            var unitY = new THREE.Vector3( 0, 1, 0 );
            var unitZ = new THREE.Vector3( 0, 0, 1 );
            var quaternionX = new THREE.Quaternion();
            var quaternionY = new THREE.Quaternion();
            var quaternionZ = new THREE.Quaternion();
            var eye = eye2.clone();

            worldRotation.copy( this.planes[ "XY" ].rotation );
            tempQuaternion.setFromEuler( worldRotation );

            tempMatrix.makeRotationFromQuaternion( tempQuaternion ).getInverse( tempMatrix );
            eye.applyMatrix4( tempMatrix );

            this.traverse( function( child ) {

                tempQuaternion.setFromEuler( worldRotation );

                if ( child.name === "X" ) {

                    quaternionX.setFromAxisAngle( unitX, Math.atan2( - eye.y, eye.z ) );
                    tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionX );
                    child.quaternion.copy( tempQuaternion );

                }

                if ( child.name === "Y" ) {

                    quaternionY.setFromAxisAngle( unitY, Math.atan2( eye.x, eye.z ) );
                    tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionY );
                    child.quaternion.copy( tempQuaternion );

                }

                if ( child.name === "Z" ) {

                    quaternionZ.setFromAxisAngle( unitZ, Math.atan2( eye.y, eye.x ) );
                    tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionZ );
                    child.quaternion.copy( tempQuaternion );

                }

            } );

        };

        this.init();

    };

    THREE.TransformGizmoRotate.prototype = Object.create( THREE.TransformGizmo.prototype );
    THREE.TransformGizmoRotate.prototype.constructor = THREE.TransformGizmoRotate;

    THREE.TransformGizmoScale = function () {

        THREE.TransformGizmo.call( this );

        var arrowGeometry = new THREE.Geometry();
        var mesh = new THREE.Mesh( new THREE.BoxGeometry( 0.125, 0.125, 0.125 ) );
        mesh.position.y = 0.5;
        mesh.updateMatrix();

        arrowGeometry.merge( mesh.geometry, mesh.matrix );

        var lineXGeometry = new THREE.BufferGeometry();
        lineXGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  1, 0, 0 ], 3 ) );

        var lineYGeometry = new THREE.BufferGeometry();
        lineYGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 1, 0 ], 3 ) );

        var lineZGeometry = new THREE.BufferGeometry();
        lineZGeometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,  0, 0, 1 ], 3 ) );

        this.handleGizmos = {

            X: [
                [ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: 0xff0000 } ) ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ],
                [ new THREE.Line( lineXGeometry, new GizmoLineMaterial( { color: 0xff0000 } ) ) ]
            ],

            Y: [
                [ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: 0x00ff00 } ) ), [ 0, 0.5, 0 ] ],
                [ new THREE.Line( lineYGeometry, new GizmoLineMaterial( { color: 0x00ff00 } ) ) ]
            ],

            Z: [
                [ new THREE.Mesh( arrowGeometry, new GizmoMaterial( { color: 0x0000ff } ) ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ] ],
                [ new THREE.Line( lineZGeometry, new GizmoLineMaterial( { color: 0x0000ff } ) ) ]
            ],

            XYZ: [
                [ new THREE.Mesh( new THREE.BoxBufferGeometry( 0.125, 0.125, 0.125 ), new GizmoMaterial( { color: 0xffffff, opacity: 0.25 } ) ) ]
            ]

        };

        this.pickerGizmos = {

            X: [
                [ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0.6, 0, 0 ], [ 0, 0, - Math.PI / 2 ] ]
            ],

            Y: [
                [ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0.6, 0 ] ]
            ],

            Z: [
                [ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), pickerMaterial ), [ 0, 0, 0.6 ], [ Math.PI / 2, 0, 0 ] ]
            ],

            XYZ: [
                [ new THREE.Mesh( new THREE.BoxBufferGeometry( 0.4, 0.4, 0.4 ), pickerMaterial ) ]
            ]

        };

        this.setActivePlane = function ( axis, eye ) {

            var tempMatrix = new THREE.Matrix4();
            eye.applyMatrix4( tempMatrix.getInverse( tempMatrix.extractRotation( this.planes[ "XY" ].matrixWorld ) ) );

            if ( axis === "X" ) {

                this.activePlane = this.planes[ "XY" ];
                if ( Math.abs( eye.y ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "XZ" ];

            }

            if ( axis === "Y" ) {

                this.activePlane = this.planes[ "XY" ];
                if ( Math.abs( eye.x ) > Math.abs( eye.z ) ) this.activePlane = this.planes[ "YZ" ];

            }

            if ( axis === "Z" ) {

                this.activePlane = this.planes[ "XZ" ];
                if ( Math.abs( eye.x ) > Math.abs( eye.y ) ) this.activePlane = this.planes[ "YZ" ];

            }

            if ( axis === "XYZ" ) this.activePlane = this.planes[ "XYZE" ];

        };

        this.init();

    };

    THREE.TransformGizmoScale.prototype = Object.create( THREE.TransformGizmo.prototype );
    THREE.TransformGizmoScale.prototype.constructor = THREE.TransformGizmoScale;

    THREE.TransformControls = function ( camera, domElement ) {

        // TODO: Make non-uniform scale and rotate play nice in hierarchies
        // TODO: ADD RXYZ contol

        THREE.Object3D.call( this );

        domElement = ( domElement !== undefined ) ? domElement : document;

        this.object = undefined;
        this.visible = false;
        this.translationSnap = null;
        this.rotationSnap = null;
        this.space = "world";
        this.size = 1;
        this.axis = null;

        var scope = this;

        var _mode = "translate";
        var _dragging = false;
        var _plane = "XY";
        var _gizmo = {

            "translate": new THREE.TransformGizmoTranslate(),
            "rotate": new THREE.TransformGizmoRotate(),
            "scale": new THREE.TransformGizmoScale()
        };

        for ( var type in _gizmo ) {

            var gizmoObj = _gizmo[ type ];

            gizmoObj.visible = ( type === _mode );
            this.add( gizmoObj );

        }

        var changeEvent = { type: "change" };
        var mouseDownEvent = { type: "mouseDown" };
        var mouseUpEvent = { type: "mouseUp", mode: _mode };
        var objectChangeEvent = { type: "objectChange" };

        var ray = new THREE.Raycaster();
        var pointerVector = new THREE.Vector2();

        var point = new THREE.Vector3();
        var offset = new THREE.Vector3();

        var rotation = new THREE.Vector3();
        var offsetRotation = new THREE.Vector3();
        var scale = 1;

        var lookAtMatrix = new THREE.Matrix4();
        var eye = new THREE.Vector3();

        var tempMatrix = new THREE.Matrix4();
        var tempVector = new THREE.Vector3();
        var tempQuaternion = new THREE.Quaternion();
        var unitX = new THREE.Vector3( 1, 0, 0 );
        var unitY = new THREE.Vector3( 0, 1, 0 );
        var unitZ = new THREE.Vector3( 0, 0, 1 );

        var quaternionXYZ = new THREE.Quaternion();
        var quaternionX = new THREE.Quaternion();
        var quaternionY = new THREE.Quaternion();
        var quaternionZ = new THREE.Quaternion();
        var quaternionE = new THREE.Quaternion();

        var oldPosition = new THREE.Vector3();
        var oldScale = new THREE.Vector3();
        var oldRotationMatrix = new THREE.Matrix4();

        var parentRotationMatrix  = new THREE.Matrix4();
        var parentScale = new THREE.Vector3();

        var worldPosition = new THREE.Vector3();
        var worldRotation = new THREE.Euler();
        var worldRotationMatrix  = new THREE.Matrix4();
        var camPosition = new THREE.Vector3();
        var camRotation = new THREE.Euler();

        domElement.addEventListener( "mousedown", onPointerDown, false );
        domElement.addEventListener( "touchstart", onPointerDown, false );

        domElement.addEventListener( "mousemove", onPointerHover, false );
        domElement.addEventListener( "touchmove", onPointerHover, false );

        domElement.addEventListener( "mousemove", onPointerMove, false );
        domElement.addEventListener( "touchmove", onPointerMove, false );

        domElement.addEventListener( "mouseup", onPointerUp, false );
        domElement.addEventListener( "mouseout", onPointerUp, false );
        domElement.addEventListener( "touchend", onPointerUp, false );
        domElement.addEventListener( "touchcancel", onPointerUp, false );
        domElement.addEventListener( "touchleave", onPointerUp, false );

        this.dispose = function () {

            domElement.removeEventListener( "mousedown", onPointerDown );
            domElement.removeEventListener( "touchstart", onPointerDown );

            domElement.removeEventListener( "mousemove", onPointerHover );
            domElement.removeEventListener( "touchmove", onPointerHover );

            domElement.removeEventListener( "mousemove", onPointerMove );
            domElement.removeEventListener( "touchmove", onPointerMove );

            domElement.removeEventListener( "mouseup", onPointerUp );
            domElement.removeEventListener( "mouseout", onPointerUp );
            domElement.removeEventListener( "touchend", onPointerUp );
            domElement.removeEventListener( "touchcancel", onPointerUp );
            domElement.removeEventListener( "touchleave", onPointerUp );

        };

        this.attach = function ( object ) {

            this.object = object;
            this.visible = true;
            this.update();

        };

        this.detach = function () {

            this.object = undefined;
            this.visible = false;
            this.axis = null;

        };

        this.getMode = function () {

            return _mode;

        };

        this.setMode = function ( mode ) {

            _mode = mode ? mode : _mode;

            if ( _mode === "scale" ) scope.space = "local";

            for ( var type in _gizmo ) _gizmo[ type ].visible = ( type === _mode );

            this.update();
            scope.dispatchEvent( changeEvent );

        };

        this.setTranslationSnap = function ( translationSnap ) {

            scope.translationSnap = translationSnap;

        };

        this.setRotationSnap = function ( rotationSnap ) {

            scope.rotationSnap = rotationSnap;

        };

        this.setSize = function ( size ) {

            scope.size = size;
            this.update();
            scope.dispatchEvent( changeEvent );

        };

        this.setSpace = function ( space ) {

            scope.space = space;
            this.update();
            scope.dispatchEvent( changeEvent );

        };

        this.update = function () {

            if ( scope.object === undefined ) return;

            scope.object.updateMatrixWorld();
            worldPosition.setFromMatrixPosition( scope.object.matrixWorld );
            worldRotation.setFromRotationMatrix( tempMatrix.extractRotation( scope.object.matrixWorld ) );

            camera.updateMatrixWorld();
            camPosition.setFromMatrixPosition( camera.matrixWorld );
            camRotation.setFromRotationMatrix( tempMatrix.extractRotation( camera.matrixWorld ) );

            scale = worldPosition.distanceTo( camPosition ) / 6 * scope.size;
            this.position.copy( worldPosition );
            this.scale.set( scale, scale, scale );

            if ( camera instanceof THREE.PerspectiveCamera ) {

                eye.copy( camPosition ).sub( worldPosition ).normalize();

            } else if ( camera instanceof THREE.OrthographicCamera ) {

                eye.copy( camPosition ).normalize();

            }

            if ( scope.space === "local" ) {

                _gizmo[ _mode ].update( worldRotation, eye );

            } else if ( scope.space === "world" ) {

                _gizmo[ _mode ].update( new THREE.Euler(), eye );

            }

            _gizmo[ _mode ].highlight( scope.axis );

        };

        function onPointerHover( event ) {

            if ( scope.object === undefined || _dragging === true || ( event.button !== undefined && event.button !== 0 ) ) return;

            var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;

            var intersect = intersectObjects( pointer, _gizmo[ _mode ].pickers.children );

            var axis = null;

            if ( intersect ) {

                axis = intersect.object.name;

                event.preventDefault();

            }

            if ( scope.axis !== axis ) {

                scope.axis = axis;
                scope.update();
                scope.dispatchEvent( changeEvent );

            }

        }

        function onPointerDown( event ) {

            if ( scope.object === undefined || _dragging === true || ( event.button !== undefined && event.button !== 0 ) ) return;

            var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;

            if ( pointer.button === 0 || pointer.button === undefined ) {

                var intersect = intersectObjects( pointer, _gizmo[ _mode ].pickers.children );

                if ( intersect ) {

                    event.preventDefault();
                    event.stopPropagation();

                    scope.dispatchEvent( mouseDownEvent );

                    scope.axis = intersect.object.name;

                    scope.update();

                    eye.copy( camPosition ).sub( worldPosition ).normalize();

                    _gizmo[ _mode ].setActivePlane( scope.axis, eye );

                    var planeIntersect = intersectObjects( pointer, [ _gizmo[ _mode ].activePlane ] );

                    if ( planeIntersect ) {

                        oldPosition.copy( scope.object.position );
                        oldScale.copy( scope.object.scale );

                        oldRotationMatrix.extractRotation( scope.object.matrix );
                        worldRotationMatrix.extractRotation( scope.object.matrixWorld );

                        parentRotationMatrix.extractRotation( scope.object.parent.matrixWorld );
                        parentScale.setFromMatrixScale( tempMatrix.getInverse( scope.object.parent.matrixWorld ) );

                        offset.copy( planeIntersect.point );

                    }

                }

            }

            _dragging = true;

        }

        function onPointerMove( event ) {

            if ( scope.object === undefined || scope.axis === null || _dragging === false || ( event.button !== undefined && event.button !== 0 ) ) return;

            var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;

            var planeIntersect = intersectObjects( pointer, [ _gizmo[ _mode ].activePlane ] );

            if ( planeIntersect === false ) return;

            event.preventDefault();
            event.stopPropagation();

            point.copy( planeIntersect.point );

            if ( _mode === "translate" ) {

                point.sub( offset );
                point.multiply( parentScale );

                if ( scope.space === "local" ) {

                    point.applyMatrix4( tempMatrix.getInverse( worldRotationMatrix ) );

                    if ( scope.axis.search( "X" ) === - 1 ) point.x = 0;
                    if ( scope.axis.search( "Y" ) === - 1 ) point.y = 0;
                    if ( scope.axis.search( "Z" ) === - 1 ) point.z = 0;

                    point.applyMatrix4( oldRotationMatrix );

                    scope.object.position.copy( oldPosition );
                    scope.object.position.add( point );

                }

                if ( scope.space === "world" || scope.axis.search( "XYZ" ) !== - 1 ) {

                    if ( scope.axis.search( "X" ) === - 1 ) point.x = 0;
                    if ( scope.axis.search( "Y" ) === - 1 ) point.y = 0;
                    if ( scope.axis.search( "Z" ) === - 1 ) point.z = 0;

                    point.applyMatrix4( tempMatrix.getInverse( parentRotationMatrix ) );

                    scope.object.position.copy( oldPosition );
                    scope.object.position.add( point );

                }

                if ( scope.translationSnap !== null ) {

                    if ( scope.space === "local" ) {

                        scope.object.position.applyMatrix4( tempMatrix.getInverse( worldRotationMatrix ) );

                    }

                    if ( scope.axis.search( "X" ) !== - 1 ) scope.object.position.x = Math.round( scope.object.position.x / scope.translationSnap ) * scope.translationSnap;
                    if ( scope.axis.search( "Y" ) !== - 1 ) scope.object.position.y = Math.round( scope.object.position.y / scope.translationSnap ) * scope.translationSnap;
                    if ( scope.axis.search( "Z" ) !== - 1 ) scope.object.position.z = Math.round( scope.object.position.z / scope.translationSnap ) * scope.translationSnap;

                    if ( scope.space === "local" ) {

                        scope.object.position.applyMatrix4( worldRotationMatrix );

                    }

                }

            } else if ( _mode === "scale" ) {

                point.sub( offset );
                point.multiply( parentScale );

                if ( scope.space === "local" ) {

                    if ( scope.axis === "XYZ" ) {

                        scale = 1 + ( ( point.y ) / Math.max( oldScale.x, oldScale.y, oldScale.z ) );

                        scope.object.scale.x = oldScale.x * scale;
                        scope.object.scale.y = oldScale.y * scale;
                        scope.object.scale.z = oldScale.z * scale;

                    } else {

                        point.applyMatrix4( tempMatrix.getInverse( worldRotationMatrix ) );

                        if ( scope.axis === "X" ) scope.object.scale.x = oldScale.x * ( 1 + point.x / oldScale.x );
                        if ( scope.axis === "Y" ) scope.object.scale.y = oldScale.y * ( 1 + point.y / oldScale.y );
                        if ( scope.axis === "Z" ) scope.object.scale.z = oldScale.z * ( 1 + point.z / oldScale.z );

                    }

                }

            } else if ( _mode === "rotate" ) {

                point.sub( worldPosition );
                point.multiply( parentScale );
                tempVector.copy( offset ).sub( worldPosition );
                tempVector.multiply( parentScale );

                if ( scope.axis === "E" ) {

                    point.applyMatrix4( tempMatrix.getInverse( lookAtMatrix ) );
                    tempVector.applyMatrix4( tempMatrix.getInverse( lookAtMatrix ) );

                    rotation.set( Math.atan2( point.z, point.y ), Math.atan2( point.x, point.z ), Math.atan2( point.y, point.x ) );
                    offsetRotation.set( Math.atan2( tempVector.z, tempVector.y ), Math.atan2( tempVector.x, tempVector.z ), Math.atan2( tempVector.y, tempVector.x ) );

                    tempQuaternion.setFromRotationMatrix( tempMatrix.getInverse( parentRotationMatrix ) );

                    quaternionE.setFromAxisAngle( eye, rotation.z - offsetRotation.z );
                    quaternionXYZ.setFromRotationMatrix( worldRotationMatrix );

                    tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionE );
                    tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionXYZ );

                    scope.object.quaternion.copy( tempQuaternion );

                } else if ( scope.axis === "XYZE" ) {

                    quaternionE.setFromEuler( point.clone().cross( tempVector ).normalize() ); // rotation axis

                    tempQuaternion.setFromRotationMatrix( tempMatrix.getInverse( parentRotationMatrix ) );
                    quaternionX.setFromAxisAngle( quaternionE, - point.clone().angleTo( tempVector ) );
                    quaternionXYZ.setFromRotationMatrix( worldRotationMatrix );

                    tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionX );
                    tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionXYZ );

                    scope.object.quaternion.copy( tempQuaternion );

                } else if ( scope.space === "local" ) {

                    point.applyMatrix4( tempMatrix.getInverse( worldRotationMatrix ) );

                    tempVector.applyMatrix4( tempMatrix.getInverse( worldRotationMatrix ) );

                    rotation.set( Math.atan2( point.z, point.y ), Math.atan2( point.x, point.z ), Math.atan2( point.y, point.x ) );
                    offsetRotation.set( Math.atan2( tempVector.z, tempVector.y ), Math.atan2( tempVector.x, tempVector.z ), Math.atan2( tempVector.y, tempVector.x ) );

                    quaternionXYZ.setFromRotationMatrix( oldRotationMatrix );

                    if ( scope.rotationSnap !== null ) {

                        quaternionX.setFromAxisAngle( unitX, Math.round( ( rotation.x - offsetRotation.x ) / scope.rotationSnap ) * scope.rotationSnap );
                        quaternionY.setFromAxisAngle( unitY, Math.round( ( rotation.y - offsetRotation.y ) / scope.rotationSnap ) * scope.rotationSnap );
                        quaternionZ.setFromAxisAngle( unitZ, Math.round( ( rotation.z - offsetRotation.z ) / scope.rotationSnap ) * scope.rotationSnap );

                    } else {

                        quaternionX.setFromAxisAngle( unitX, rotation.x - offsetRotation.x );
                        quaternionY.setFromAxisAngle( unitY, rotation.y - offsetRotation.y );
                        quaternionZ.setFromAxisAngle( unitZ, rotation.z - offsetRotation.z );

                    }

                    if ( scope.axis === "X" ) quaternionXYZ.multiplyQuaternions( quaternionXYZ, quaternionX );
                    if ( scope.axis === "Y" ) quaternionXYZ.multiplyQuaternions( quaternionXYZ, quaternionY );
                    if ( scope.axis === "Z" ) quaternionXYZ.multiplyQuaternions( quaternionXYZ, quaternionZ );

                    scope.object.quaternion.copy( quaternionXYZ );

                } else if ( scope.space === "world" ) {

                    rotation.set( Math.atan2( point.z, point.y ), Math.atan2( point.x, point.z ), Math.atan2( point.y, point.x ) );
                    offsetRotation.set( Math.atan2( tempVector.z, tempVector.y ), Math.atan2( tempVector.x, tempVector.z ), Math.atan2( tempVector.y, tempVector.x ) );

                    tempQuaternion.setFromRotationMatrix( tempMatrix.getInverse( parentRotationMatrix ) );

                    if ( scope.rotationSnap !== null ) {

                        quaternionX.setFromAxisAngle( unitX, Math.round( ( rotation.x - offsetRotation.x ) / scope.rotationSnap ) * scope.rotationSnap );
                        quaternionY.setFromAxisAngle( unitY, Math.round( ( rotation.y - offsetRotation.y ) / scope.rotationSnap ) * scope.rotationSnap );
                        quaternionZ.setFromAxisAngle( unitZ, Math.round( ( rotation.z - offsetRotation.z ) / scope.rotationSnap ) * scope.rotationSnap );

                    } else {

                        quaternionX.setFromAxisAngle( unitX, rotation.x - offsetRotation.x );
                        quaternionY.setFromAxisAngle( unitY, rotation.y - offsetRotation.y );
                        quaternionZ.setFromAxisAngle( unitZ, rotation.z - offsetRotation.z );

                    }

                    quaternionXYZ.setFromRotationMatrix( worldRotationMatrix );

                    if ( scope.axis === "X" ) tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionX );
                    if ( scope.axis === "Y" ) tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionY );
                    if ( scope.axis === "Z" ) tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionZ );

                    tempQuaternion.multiplyQuaternions( tempQuaternion, quaternionXYZ );

                    scope.object.quaternion.copy( tempQuaternion );

                }

            }

            scope.update();
            scope.dispatchEvent( changeEvent );
            scope.dispatchEvent( objectChangeEvent );

        }

        function onPointerUp( event ) {

            event.preventDefault(); // Prevent MouseEvent on mobile

            if ( event.button !== undefined && event.button !== 0 ) return;

            if ( _dragging && ( scope.axis !== null ) ) {

                mouseUpEvent.mode = _mode;
                scope.dispatchEvent( mouseUpEvent );

            }

            _dragging = false;

            if ( 'TouchEvent' in window && event instanceof TouchEvent ) {

                // Force "rollover"

                scope.axis = null;
                scope.update();
                scope.dispatchEvent( changeEvent );

            } else {

                onPointerHover( event );

            }

        }

        function intersectObjects( pointer, objects ) {

            var rect = domElement.getBoundingClientRect();
            var x = ( pointer.clientX - rect.left ) / rect.width;
            var y = ( pointer.clientY - rect.top ) / rect.height;

            pointerVector.set( ( x * 2 ) - 1, - ( y * 2 ) + 1 );
            ray.setFromCamera( pointerVector, camera );

            var intersections = ray.intersectObjects( objects, true );
            return intersections[ 0 ] ? intersections[ 0 ] : false;

        }

    };

    THREE.TransformControls.prototype = Object.create( THREE.Object3D.prototype );
    THREE.TransformControls.prototype.constructor = THREE.TransformControls;

    THREE.FirstPersonControls = function ( object, domElement ) {

        this.object = object;
        this.target = new THREE.Vector3( 0, 0, 0 );

        this.domElement = ( domElement !== undefined ) ? domElement : document;

        this.enabled = true;

        this.movementSpeed = 1.0;
        this.lookSpeed = 0.005;

        this.lookVertical = false;
        this.autoForward = false;

        this.activeLook = true;

        this.heightSpeed = false;
        this.heightCoef = 1.0;
        this.heightMin = 0.0;
        this.heightMax = 1.0;

        this.constrainVertical = false;
        this.verticalMin = 0;
        this.verticalMax = Math.PI;

        this.autoSpeedFactor = 0.0;

        this.mouseX = 0;
        this.mouseY = 0;

        this.lat = 0;
        this.lon = 0;
        this.phi = 0;
        this.theta = 0;

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        this.mouseDragOn = false;

        this.viewHalfX = 0;
        this.viewHalfY = 0;

        if ( this.domElement !== document ) {

            this.domElement.setAttribute( 'tabindex', - 1 );

        }

        //

        this.handleResize = function () {

            if ( this.domElement === document ) {

                this.viewHalfX = window.innerWidth / 2;
                this.viewHalfY = window.innerHeight / 2;

            } else {

                this.viewHalfX = this.domElement.offsetWidth / 2;
                this.viewHalfY = this.domElement.offsetHeight / 2;

            }

        };

        this.onMouseDown = function ( event ) {

            if ( this.domElement !== document ) {

                this.domElement.focus();

            }

            event.preventDefault();
            event.stopPropagation();

            if ( this.activeLook ) {

                switch ( event.button ) {

                    case 0: this.moveForward = true; break;
                    case 2: this.moveBackward = true; break;

                }

            }

            this.mouseDragOn = true;

        };

        this.onMouseUp = function ( event ) {

            event.preventDefault();
            event.stopPropagation();

            if ( this.activeLook ) {

                switch ( event.button ) {

                    case 0: this.moveForward = false; break;
                    case 2: this.moveBackward = false; break;

                }

            }

            this.mouseDragOn = false;

        };

        this.onMouseMove = function ( event ) {

            if ( this.domElement === document ) {

                this.mouseX = event.pageX - this.viewHalfX;
                this.mouseY = event.pageY - this.viewHalfY;

            } else {

                this.mouseX = event.pageX - this.domElement.offsetLeft - this.viewHalfX;
                this.mouseY = event.pageY - this.domElement.offsetTop - this.viewHalfY;

            }

        };

        this.onKeyDown = function ( event ) {

            //event.preventDefault();

            switch ( event.keyCode ) {

                case 38: /*up*/
                case 87: /*W*/ this.moveForward = true; break;

                case 37: /*left*/
                case 65: /*A*/ this.moveLeft = true; break;

                case 40: /*down*/
                case 83: /*S*/ this.moveBackward = true; break;

                case 39: /*right*/
                case 68: /*D*/ this.moveRight = true; break;

                case 82: /*R*/ this.moveUp = true; break;
                case 70: /*F*/ this.moveDown = true; break;

            }

        };

        this.onKeyUp = function ( event ) {

            switch ( event.keyCode ) {

                case 38: /*up*/
                case 87: /*W*/ this.moveForward = false; break;

                case 37: /*left*/
                case 65: /*A*/ this.moveLeft = false; break;

                case 40: /*down*/
                case 83: /*S*/ this.moveBackward = false; break;

                case 39: /*right*/
                case 68: /*D*/ this.moveRight = false; break;

                case 82: /*R*/ this.moveUp = false; break;
                case 70: /*F*/ this.moveDown = false; break;

            }

        };

        this.update = function( delta ) {

            if ( this.enabled === false ) return;

            if ( this.heightSpeed ) {

                var y = THREE.Math.clamp( this.object.position.y, this.heightMin, this.heightMax );
                var heightDelta = y - this.heightMin;

                this.autoSpeedFactor = delta * ( heightDelta * this.heightCoef );

            } else {

                this.autoSpeedFactor = 0.0;

            }

            var actualMoveSpeed = delta * this.movementSpeed;

            if ( this.moveForward || ( this.autoForward && ! this.moveBackward ) ) this.object.translateZ( - ( actualMoveSpeed + this.autoSpeedFactor ) );
            if ( this.moveBackward ) this.object.translateZ( actualMoveSpeed );

            if ( this.moveLeft ) this.object.translateX( - actualMoveSpeed );
            if ( this.moveRight ) this.object.translateX( actualMoveSpeed );

            if ( this.moveUp ) this.object.translateY( actualMoveSpeed );
            if ( this.moveDown ) this.object.translateY( - actualMoveSpeed );

            var actualLookSpeed = delta * this.lookSpeed;

            if ( ! this.activeLook ) {

                actualLookSpeed = 0;

            }

            var verticalLookRatio = 1;

            if ( this.constrainVertical ) {

                verticalLookRatio = Math.PI / ( this.verticalMax - this.verticalMin );

            }

            this.lon += this.mouseX * actualLookSpeed;
            if ( this.lookVertical ) this.lat -= this.mouseY * actualLookSpeed * verticalLookRatio;

            this.lat = Math.max( - 85, Math.min( 85, this.lat ) );
            this.phi = THREE.Math.degToRad( 90 - this.lat );

            this.theta = THREE.Math.degToRad( this.lon );

            if ( this.constrainVertical ) {

                this.phi = THREE.Math.mapLinear( this.phi, 0, Math.PI, this.verticalMin, this.verticalMax );

            }

            var targetPosition = this.target,
                position = this.object.position;

            targetPosition.x = position.x + 100 * Math.sin( this.phi ) * Math.cos( this.theta );
            targetPosition.y = position.y + 100 * Math.cos( this.phi );
            targetPosition.z = position.z + 100 * Math.sin( this.phi ) * Math.sin( this.theta );

            this.object.lookAt( targetPosition );

        };

        function contextmenu( event ) {

            event.preventDefault();

        }

        this.dispose = function() {

            this.domElement.removeEventListener( 'contextmenu', contextmenu, false );
            this.domElement.removeEventListener( 'mousedown', _onMouseDown, false );
            this.domElement.removeEventListener( 'mousemove', _onMouseMove, false );
            this.domElement.removeEventListener( 'mouseup', _onMouseUp, false );

            window.removeEventListener( 'keydown', _onKeyDown, false );
            window.removeEventListener( 'keyup', _onKeyUp, false );

        }

        var _onMouseMove = bind( this, this.onMouseMove );
        var _onMouseDown = bind( this, this.onMouseDown );
        var _onMouseUp = bind( this, this.onMouseUp );
        var _onKeyDown = bind( this, this.onKeyDown );
        var _onKeyUp = bind( this, this.onKeyUp );

        this.domElement.addEventListener( 'contextmenu', contextmenu, false );
        this.domElement.addEventListener( 'mousemove', _onMouseMove, false );
        this.domElement.addEventListener( 'mousedown', _onMouseDown, false );
        this.domElement.addEventListener( 'mouseup', _onMouseUp, false );

        window.addEventListener( 'keydown', _onKeyDown, false );
        window.addEventListener( 'keyup', _onKeyUp, false );

        function bind( scope, fn ) {

            return function () {

                fn.apply( scope, arguments );

            };

        }

        this.handleResize();

    };

    return THREE;
});