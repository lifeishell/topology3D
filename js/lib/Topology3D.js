define(['ThreeControls'], function (THREE) {

    function Topology3D(elementId){
        var self = this;
        var selector = '#'+ elementId;
        var geoObjects = [], positions = [];
        var height = 800; //$(selector).height();
        var width = $(selector).width();
        var geometry = new THREE.BoxGeometry( 5, 5, 5 );

        //setup scene
        this.scene = new THREE.Scene();
        //setup camera and add to scene
        this.camera = new THREE.PerspectiveCamera( 70, width / height, 0.1, 1000 );
        this.camera.position.z = 600;
        this.scene.add(this.camera);

        // add light to scene
        this.scene.add( new THREE.AmbientLight( 0xf0f0f0 ) );
        var light = new THREE.SpotLight( 0xffff00, 1.5 );
        light.position.set( 0, 1500, 200 );
        light.castShadow = true;
        light.shadow = new THREE.LightShadow( new THREE.PerspectiveCamera( 70, 1, 200, 2000 ) );
        light.shadow.bias = -0.000222;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
        this.scene.add( light );

        // add bottom plane
        var planeGeometry = new THREE.PlaneGeometry( 2000, 2000 );
        planeGeometry.rotateX( - Math.PI / 2 );
        var planeMaterial = new THREE.ShadowMaterial();
        planeMaterial.opacity = 0.2;
        var plane = new THREE.Mesh( planeGeometry, planeMaterial );
        plane.position.y = -4;
        plane.receiveShadow = true;
        self.scene.add( plane );

        var helper = new THREE.GridHelper( 2000, 100 );
        helper.position.y = -3;
        helper.material.opacity = 0.25;
        helper.material.transparent = true;
        self.scene.add( helper );
        var axis = new THREE.AxisHelper();
        axis.position.set( -500, -500, -500 );
        self.scene.add( axis );


        this.initTopologyData = function(data){
            var deferred = $.Deferred();
            //load font
            var loader = new THREE.FontLoader();
            loader.load( 'font/helvetiker_regular.typeface.json', function ( font ) {
                var group = new THREE.Group();
                $.each(data, function(i, d){
                    var x = Number(d.x) / 5 - 300;
                    var y = Math.random() * 100;
                    var z = Number(d.y) / 5;
                    var text = d.ip || 'cloud';
                    var textGeo = new THREE.TextGeometry(text, { font: font, size: 5, height: 1 });
                    textGeo.computeBoundingBox();
                    var texture = new THREE.Mesh(textGeo, new THREE.MeshLambertMaterial( {
                        color: 0x333333
                    } ) );
                    texture.position.x = x - 10;
                    texture.position.y = y - 10;
                    texture.position.z = z - 10;
                    texture.lookAt(self.camera.position);
                    group.add(texture);

                    var object = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( {
                        color: 0x285064
                    } ) );
                    object.material.ambient = object.material.color;
                    object.position.x = x;
                    object.position.y = y;
                    object.position.z = z;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    self.scene.add( object );
                    geoObjects.push({ data: d, obj: object });
                });
                self.scene.add( group );
                $.each(geoObjects, function (i, n) {
                    $.each(n.data.links, function(i, link){
                        if(link.type == 'cloud'){
                            var target = geoObjects.filter(function(o){
                                return o.data.dev_id == link.type;
                            });
                            if(target.length){
                                positions.push([target[0].obj.position, n.obj.position]);
                            }
                        } else {
                            var target = geoObjects.filter(function(o){
                                return o.data.dev_id == link.dev_id;
                            });
                            if(target.length){
                                positions.push([target[0].obj.position, n.obj.position]);
                            }
                        }
                    });
                });

                deferred.resolve();
            });

            return deferred.promise();
        };

        this.drawLayout = function(){

            self.drawCurves();

            var renderer = new THREE.WebGLRenderer( { antialias: true } );
            renderer.setClearColor( 0xf0f0f0 );
            renderer.setPixelRatio( window.devicePixelRatio );
            renderer.setSize( width, height );
            renderer.shadowMap.enabled = true;
            $(selector).append( renderer.domElement );

            //setup controls
            var controls = new THREE.OrbitControls( self.camera, renderer.domElement );
            controls.damping = 0.2;
            controls.enablePan = false;
            controls.addEventListener( 'change', render );

            var transformControl = new THREE.TransformControls( self.camera, renderer.domElement );
            transformControl.addEventListener( 'change', render );
            self.scene.add( transformControl );

            controls.addEventListener( 'start', function() {
                cancelHideTransform();
            } );
            controls.addEventListener( 'end', function() {
                delayHideTransform();
            } );

            var hiding;
            function delayHideTransform() {
                cancelHideTransform();
                hideTransform();
            }
            function hideTransform() {
                hiding = setTimeout( function() {
                    transformControl.detach( transformControl.object );
                }, 2500 )
            }
            function cancelHideTransform() {
                if ( hiding ) clearTimeout( hiding );
            }


            function render(){
                requestAnimationFrame( render );
                renderer.render( self.scene, self.camera );

                transformControl.update();
            }
            render();
        };


        /*******
         * Curves
         *********/
        this.drawCurves = function(){

            for (var i = 0; i < positions.length; i ++ ) {
                var geometry = new THREE.Geometry();
                geometry.vertices.push( positions[i][0] );
                geometry.vertices.push( positions[i][1] );

                var line = new THREE.Line( geometry, new THREE.LineBasicMaterial( {
                    color: 0x999999,
                    opacity: 0.1
                } ) );

                self.scene.add( line );
            }

        }
    }

    return Topology3D;
});