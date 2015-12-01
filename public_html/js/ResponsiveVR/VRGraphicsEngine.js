
VRGraphicsEngine = {};
(function (VRGraphicsEngine, THREE, screen, window) {
	
	mouseXPos = 0;
	mouseYPos = 0;
	
	window.addEventListener( 'mousemove', function(event) {
		mouseXPos = ( event.clientX / window.innerWidth ) * 2 - 1;
		mouseYPos = - ( event.clientY / window.innerHeight ) * 2 + 1;	
	}, false );


	
	VRIsSupported = navigator.mozGetVRDevices || navigator.getVRDevices;
	if(Utils.QueryString.debug) VRIsSupported = false;
	
	desktopRenderer = null;
	VRRenderer = null;
	renderer = null;
	threeJsScene = null;
	
	newScene = null;
	newModel = null;
	sceneModel = null;
	contentPlane = null;
	
	camera = null;
	cameraOffset = new THREE.Object3D();
	controls = null;
	raycaster = new THREE.Raycaster();
	linkObjects = [];
	videoObjects = [];
	backgroundVideoSphereTexture = null;
	cursorSphere = null;
	backgroundSphere = null;
	
	articles = [];
	contentPlaneHolder = null;
	avatar2 = null;
	
	avatar = {
		scale : { x : 0.09, y: 0.09, z : 0.09 },
		rotation : { x : 0, y : -Math.PI , z : 0 },
		position : { x : 0.70, y : -0.70, z : -0.5 },
		model: null,
		bones: [
			{
				name: "head",
				meshName: "Head_Cube.001",
				meshGroup: null,
				pivotPositionOffset : { x : 0, y : 0, z : 0 },
				groupPositionOffset : { x : 0, y : 7, z : 0 },
				pivotRotationOffset : { x : 0, y : -Math.PI / 2, z : 0 },
				groupRotationOffset : { x : 0, y :  Math.PI / 2, z : 0 }
			},
			{
				name: "rightArm",
				meshName: "Right_Arm_Cube.013",
				meshGroup: null,
				pivotPositionOffset : { x : 0, y : 0, z : -1 },
				groupPositionOffset : { x : 0, y : 5.5, z : -1 },
				pivotRotationOffset : { x : 0, y : -Math.PI / 2, z : 0 },
				groupRotationOffset : { x : 0, y : 0, z : 0 }
			},
			{
				name: "leftArm",
				meshName: "Left_Arm_Cube.012",
				meshGroup: null,
				pivotPositionOffset : { x : 0, y : 0, z : 1 },
				groupPositionOffset : { x : 0, y : 5.5, z : 1 },
				pivotRotationOffset : { x : 0, y : -Math.PI / 2, z : 0 },
				groupRotationOffset : { x : 0, y : 0, z : 0 }
			},
			{
				name: "rightLeg",
				meshName: "Right_Leg_Cube.010",
				meshGroup: null,
				pivotPositionOffset : { x : 0, y : 1.6, z : 0 },
				groupPositionOffset : { x : 0, y : 3.2, z : 0.5 },
				pivotRotationOffset : { x : Math.PI / 2, y : 0, z : Math.PI / 2, },
				groupRotationOffset : { x : 0, y : 0, z : 0 }
			},
			{
				name: "leftLeg",
				meshName: "Left_Leg_Cube.005",
				meshGroup: null,
				pivotPositionOffset : { x : 0, y : 1.6, z : 0 },
				groupPositionOffset : { x : 0, y : 3.2, z : -0.5 },
				pivotRotationOffset : { x : 0, y : 0, z : 0 },
				groupRotationOffset : { x : 0, y : 0, z : 0 }
			}
			
		]
	}
	
	
	webcam = {
		markers : {
			QRMarkerObjects : [],
			QRParams : null,
			QRScene : null,
			qrTrackers : null
		},
		image : {
			webcamCanvas : null,
			webcamTexture : null,
			webcameraImagePlane : null,
			webcameraPlane : null,
			webcamCamera : null
		}
	}
		
	
	var activeMenuItem = {
		object: null,
		selectionStartTime: 0
	}

	MENU_SELECTION_DELAY = 1000;
	MENU_ITEM_SCALE_CHANGE = 1.3;
	HOME_PAGE_COLOR = 0xffffff;
	
	VRGraphicsEngine.createCanvas = function(element) {
		
		desktopRenderer = new THREE.WebGLRenderer();
		desktopRenderer.setSize(screen.width, screen.height);
		desktopRenderer.setClearColor( 0x000000, 1);
		
		VRRenderer = new THREE.VREffect(desktopRenderer);
		VRRenderer.setSize(screen.width, screen.height);
		if(VRIsSupported) renderer = VRRenderer;
		else renderer = desktopRenderer;
		desktopRenderer.domElement.style.display = "none";
		
		// webcamRenderer = new THREE.WebGLRenderer();
		// webcamRenderer.setSize(screen.width, screen.height);
		// webcamRenderer.setClearColor( 0xff0000, 1);
		// webcamRenderer.autoClear = false;
		// //desktopRenderer.clear();
		
		webcamRenderTarget = new THREE.WebGLRenderTarget( 480, 640, { format: THREE.RGBFormat } );
		webcamRenderTarget.minFilter = THREE.NearestFilter;
		
		element.appendChild(desktopRenderer.domElement);
		Utils.addFullscreenLink(desktopRenderer);
		
		// Camera
		camera = new THREE.PerspectiveCamera(90, screen.width / screen.height, 0.1, 10000);
		camera.position.set(0,0,0.05);
		
		// Camera for the QRMarkers (Require their own projection matrix)
		webcam.image.webcamCamera =  new THREE.Camera();
		
		// Controls
		if(VRIsSupported) controls = new THREE.VRControls(camera);
		else controls = new THREE.OrbitControls(camera, desktopRenderer.domElement);
		
		var fullScreenChange = 
			desktopRenderer.domElement.mozRequestFullScreen ? 'mozfullscreenchange' : 'webkitfullscreenchange';
		document.addEventListener( fullScreenChange, onFullScreenChanged, false );
		function onFullScreenChanged() {
			if(VRIsSupported) VRRenderer.setFullScreen(false);
			// Fullscreen switched off
			if ( !document.mozFullScreenElement && !document.webkitFullscreenElement ) {
				desktopRenderer.domElement.style.display = "none";
			}
		}
	}
	
	VRGraphicsEngine.connectTo = function(model) {
		linkObjects = [];
		videoObjects = [];
		activeMenuItem = {
			object: null,
			selectionStartTime: 0
		}
	
		newScene = new THREE.Scene();
		webcamScene = new THREE.Scene(); 
		newModel = model;
		
		var header = new THREE.Object3D(); header.name = "header";
		var links =  new THREE.Object3D(); links.name = "links";
		articles =  new THREE.Object3D(); articles.name = "articles";
		var footer =  new THREE.Object3D(); footer.name = "footer";
		newScene.add(header, links, articles, footer);
		newScene.links = [];
		
		header.add(VRSceneBuilder.addHeader(newModel.state.elements.header));
		
		for(var i = 0; i < newModel.state.elements.links.length; i++) { 
			links.add(VRSceneBuilder.addLink(newModel.state.elements.links[i], i, newModel.state.elements.links.length)); 
		}
		for(var i = 0; i < newModel.state.elements.articles.length; i++) { 
			articles.add(VRSceneBuilder.addArticle(newModel.state.elements.articles[i], i, newModel.state.elements.articles.length)); 
		}
		footer.add(VRSceneBuilder.addFooter(newModel.state.elements.footer));
		
		
		var cursorMaterial = new THREE.MeshBasicMaterial( 
			{ color: 0xff0000, transparent: true, opacity: 0.65, depthTest: false }
		);
		var greyMaterial = new THREE.MeshBasicMaterial( 
			{ color: 0xcccccc, transparent: true, 	depthTest: false } 
		);
		
		avatar.model =  new THREE.Object3D();
		avatar.model.scale.set(avatar.scale.x, avatar.scale.y, avatar.scale.z);
		avatar.model.rotation.set(avatar.rotation.x, avatar.rotation.y, avatar.rotation.z);
		avatar.model.position.set(avatar.position.x, avatar.position.y, avatar.position.z);
		VRSceneBuilder.loadAndAddObject("objmtl", "media/models/minecraft/minecraft2.obj|media/models/minecraft/minecraft2.mtl", avatar.model);
		newScene.add(avatar.model);
		
		// avatar2 =  new THREE.Object3D();
		// VRSceneBuilder.loadAndAddObject("json", "media/models/007/json/model2_json.json", avatar2);
		// console.log(avatar2);
		// newScene.add(avatar2);
		// avatar2.rotation.set(avatar.rotation.x, avatar.rotation.y, avatar.rotation.z);
		// avatar2.position.set(avatar.position.x, avatar.position.y, avatar.position.z);
		// avatar2.scale.set(0.5, 0.5, 0.5);
		
		// Add cursor sphere object for menu selection
		var cursorSphereGeom =  new THREE.SphereGeometry( 0.01, 10, 10 );
		cursorSphere = new THREE.Mesh( cursorSphereGeom, cursorMaterial );
		cursorSphere.name="cursorSphere";
		cursorSphere.originalScale = 0.01;
		
		// Add back, toggle hud and toggle webcam spheres
		var navSphereGeom =  new THREE.SphereGeometry( 0.1, 10, 10 );
		var backSphere =  new THREE.Object3D();
		backSphereMesh = new THREE.Mesh( navSphereGeom, greyMaterial );
		backSphereMesh.name="mesh";
		backSphere.add(backSphereMesh);
		backSphere.position.set(-0.25,-1,-1);
		backSphere.name="backSphere";
		backSphere.vr = {};
		backSphere.vr.type = "back";
		
		var toggleHudSphere =  new THREE.Object3D();
		toggleHudSphereMesh = new THREE.Mesh( navSphereGeom, greyMaterial );
		toggleHudSphereMesh.name="mesh";
		toggleHudSphere.add(toggleHudSphereMesh);
		toggleHudSphere.position.set(0,-1,-1);
		toggleHudSphere.name = "toggleHudSphere";
		toggleHudSphere.vr = {};
		toggleHudSphere.vr.type = "toggleHud";
		
		var toggleWebcamSphere =  new THREE.Object3D();
		toggleWebcamSphereMesh = new THREE.Mesh( navSphereGeom, greyMaterial );
		toggleWebcamSphereMesh.name="mesh";
		toggleWebcamSphere.add(toggleWebcamSphereMesh);
		toggleWebcamSphere.position.set(0.25,-1,-1);
		toggleWebcamSphere.name = "toggleWebcamSphere";
		toggleWebcamSphere.vr = {};
		toggleWebcamSphere.vr.type = "toggleWebcam";
		
		newScene.add(backSphere, toggleHudSphere, toggleWebcamSphere);
		VRGraphicsEngine.makeObjectALink(backSphere);
		VRGraphicsEngine.makeObjectALink(toggleHudSphere);
		VRGraphicsEngine.makeObjectALink(toggleWebcamSphere);
		
		// Add background sphere
		var geometry = new THREE.SphereGeometry( 9000, 64, 32 );
		geometry.applyMatrix( new THREE.Matrix4().makeScale( -1, 1, 1 ) );	
		var material = new THREE.MeshBasicMaterial( {color: HOME_PAGE_COLOR} );
		backgroundSphere = new THREE.Mesh( geometry,  material );
		backgroundSphere.name = "backgroundSphere";
		backgroundSphere.rotation.set(0, -Math.PI / 2, 0, 'XYZ');
		newScene.add(backgroundSphere);
		
		// Content plane
		contentPlane =  new THREE.Object3D();
		contentPlane.name="contentPlane";
		contentPlane.rotation.copy(new THREE.Euler(0, 0, 0, "XYZ"));
		contentPlane.position.copy(new THREE.Vector3(0, 0, -HUD_RADIUS));
		
		contentPlaneHolder =  new THREE.Object3D();
		contentPlaneHolder.add(contentPlane);
		newScene.add(contentPlaneHolder);
		
		// Webcamera plane
		webcam.image.webcameraPlane = new THREE.Mesh(
		  new THREE.PlaneGeometry(3.2, 2.3, 0),
		  new THREE.MeshBasicMaterial({color: 0xff0000})
		);
		webcam.image.webcameraPlane.name="webcam.image.webcameraPlane";
		webcam.image.webcameraPlane.position.set(0,0,2.6);
		webcam.image.webcameraPlane.material.depthTest = false;
		webcam.image.webcameraPlane.material.depthWrite = false;
		webcamScene.add(webcam.image.webcameraPlane);
		
		var webcameraDistance = 0.75;
		if(webcam.image.webcameraImagePlane) camera.remove(webcam.image.webcameraImagePlane);
		webcam.image.webcameraImagePlane = new THREE.Mesh(
			new THREE.PlaneGeometry(0.8654 * webcameraDistance, 1.1547 * webcameraDistance, 1),
			new THREE.MeshBasicMaterial({ map: webcamRenderTarget})
		);
		webcam.image.webcameraImagePlane.position.set(0,0,-webcameraDistance);
		webcam.image.webcameraImagePlane.visible = false;
		camera.add(webcam.image.webcameraImagePlane);
		
		// Lights, camera, action!
		webcamScene.add( new THREE.AmbientLight( 0xffffff ) );
		webcamScene.add(webcam.image.webcamCamera);
		newScene.add( new THREE.AmbientLight( 0xffffff ) );
		cameraOffset.add(camera);
		newScene.add(cameraOffset);
		
		if(threeJsScene == null) {
			sceneModel = newModel;
			threeJsScene = newScene; 
			animate();
			// Hide/show objects according to model sate
			checkVisibility();
		}
		else { waitForSceneLoad();}
		
	}
	
	var waitForSceneLoad = function() {
		if(VRSceneBuilder.objectsBeingLoaded != 0) {
			setTimeout(waitForSceneLoad, 50);
			return;
		}
		sceneModel = newModel;
		threeJsScene = newScene; 
		checkVisibility();
		
	}

	activateFullscreen = function() {
		desktopRenderer.domElement.style.display = "block";
		if(VRIsSupported) { VRRenderer.setFullScreen(true); }
		else {
			if ( desktopRenderer.domElement.mozRequestFullScreen ) {
				desktopRenderer.domElement.mozRequestFullScreen();
			}
			else if ( desktopRenderer.domElement.webkitRequestFullscreen ) {
				desktopRenderer.domElement.webkitRequestFullscreen();
			}
		}
	}
	
	var resetView = function() {
		navigator.getVRDevices().then(function(devices) {
			for (var i = 0; i < devices.length; ++i) {if (devices[i] instanceof HMDVRDevice) {  gHMD = devices[i]; break;}  }
			if (gHMD) {
				for (var i = 0; i < devices.length; ++i) {
					if (devices[i] instanceof PositionSensorVRDevice 
						&& devices[i].hardwareUnitId === gHMD.hardwareUnitId
						) 
						{
						gPositionSensor = devices[i]; gPositionSensor.resetSensor();break;
					}
				}
			}
		});
	}

	var setBoneOffsets = function(bone) {
		bone.meshGroup.traverse(function (child) {
			 if (child instanceof THREE.Mesh) {
				child.geometry.center();
				child.position.set(
					bone.pivotPositionOffset.x,
					bone.pivotPositionOffset.y,
					bone.pivotPositionOffset.z	
				);
				child.rotation.set(
					bone.groupRotationOffset.x,
					bone.groupRotationOffset.y,
					bone.groupRotationOffset.z,
					'XYZ'
				);
			}
		});
		bone.meshGroup.position.set(
			bone.groupPositionOffset.x,
			bone.groupPositionOffset.y,
			bone.groupPositionOffset.z	
		);
	}
	
	var setJoinRotation = function(jointBone, inputRotation) {
		if(inputRotation) {
			var offsetRotation = new THREE.Quaternion();
			offsetRotation.setFromEuler(
				new THREE.Euler(
					jointBone.pivotRotationOffset.x,
					jointBone.pivotRotationOffset.y,
					jointBone.pivotRotationOffset.z,
					'XYZ'
				)
			);
			var hmdRotation = new THREE.Quaternion(
				inputRotation.x,
				inputRotation.y,
				inputRotation.z,
				inputRotation.w
			);
			offsetRotation.multiply(hmdRotation);
			jointBone.meshGroup.rotation.setFromQuaternion(offsetRotation);
		}
	}
	
	var getJointRotation = function(jointA_index, jointB_index, skeleton_index) {
		var positionA = getJointPositionVector(jointA_index, skeleton_index);
		var positionB = getJointPositionVector(jointB_index, skeleton_index);
		var directionVector = positionA.sub(positionB);
		
		var quaternion = new THREE.Quaternion();
		quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), directionVector.normalize());
		return quaternion;
	}
	
	var getJointPositionVector = function(joint_index, skeleton_index) {
		
		var vector = new THREE.Vector3(0,0,1);
		if(typeof sceneModel.state.inputDevices.local.skeletons[skeleton_index] != 'undefined') {
			vector.set(
				sceneModel.state.inputDevices.local.skeletons[skeleton_index][joint_index][0][0],
				sceneModel.state.inputDevices.local.skeletons[skeleton_index][joint_index][0][1],
				sceneModel.state.inputDevices.local.skeletons[skeleton_index][joint_index][0][2]
			);
		}
	
		return vector;
	}
	
	var animate = function() {
		
		if(sceneModel.state.moveToAdminView) {
			// cameraOffset.position.copy(avatar.model.position);
			// cameraOffset.position.setY(0);
			// cameraOffset.rotation.copy(avatar.model.rotation);
			sceneModel.state.moveToAdminView = false;
			avatar.model.position.set(0,avatar.model.position.y,0);
			avatar.model.rotation.set(0,avatar.model.rotation.y - Math.PI / 2,0,'XYZ');
			
		}
		
		// Check if avatar model has loaded
		if(avatar.model.children.length > 0) {
			
			// Kinect data
			if(sceneModel.state.inputDevices.local.skeletons.length > 0) { 
			
				for(var i = 0; i < avatar.bones.length; i++) {
					
					// Set bone if not set
					if(avatar.bones[i].meshGroup == null) {
						avatar.bones[i].meshGroup = avatar.model.getObjectByName(avatar.bones[i].meshName);
						setBoneOffsets(avatar.bones[i]);
					}
					
					// Set bone rotation
					var rotation = {x :0, y:0, z:0, w:1 };
					
					switch(avatar.bones[i].name) {
						case "head":rotation =  sceneModel.state.inputDevices.local.HMDs[0];break;
						case "leftArm":rotation = getJointRotation(10, 9, 0);break;
						case "rightArm":rotation = getJointRotation(5, 6, 0);break;
						case "leftLeg":rotation = getJointRotation(13, 12, 0);break;
						case "rightLeg":rotation = getJointRotation(17, 16, 0);break;
					}
					
					setJoinRotation(avatar.bones[i], rotation);
				}
			}
			else { // Just head rotation
				avatar.bones[0].meshGroup = avatar.model.getObjectByName(avatar.bones[0].meshName);
				setBoneOffsets(avatar.bones[0]);
				setJoinRotation(avatar.bones[0],  sceneModel.state.inputDevices.local.HMDs[0]);
			}
			
		}
		
		if(sceneModel.state.inputDevices.local.webCameraImage && !webcam.image.webcameraPlane.material.map) {
		
			webcam.image.webcamTexture = new THREE.Texture(sceneModel.state.inputDevices.local.webCameraImage);
			webcam.image.webcamTexture.minFilter = THREE.NearestFilter;
			webcam.image.webcameraPlane.material = new THREE.MeshBasicMaterial( 
				{
					map: webcam.image.webcamTexture
				} 
			);
			
		}
		if(webcam.image.webcameraPlane.material.map) {
			webcam.image.webcamTexture.needsUpdate = true;
		}
		
		var indexOfReset = sceneModel.state.inputDevices.local.keyboard.keysPressed.indexOf(122);
		if(indexOfReset > -1)  {
			sceneModel.state.inputDevices.local.keyboard.keysPressed.splice(indexOfReset, 1);
			resetView();
			console.log("Resetting HMD view");
		}
		
		handleQRTrackerObjects();
		
		if(webcam.markers.QRParams == null && sceneModel.state.inputDevices.local.webcamCameraParams != null) {
			var m = new Float32Array(16);
			webcam.markers.QRParams = sceneModel.state.inputDevices.local.webcamCameraParams;
			webcam.markers.QRParams.copyCameraMatrix(m, 0.1, 10000);
			webcam.image.webcamCamera.projectionMatrix.set(
				m[0], m[4], m[8], m[12],
				m[1], m[5], m[9], m[13],
				m[2], m[6], m[10], m[14],
				m[3], m[7], m[11], m[15]
			);
			console.log("QR tracker ready");
		}
		
		desktopRenderer.render(webcamScene, webcam.image.webcamCamera, webcamRenderTarget, true );
		renderer.render(threeJsScene, camera);
		
		// Add hover effect to middle content
		var d = new Date();
		var n = d.getTime(); 
		articles.position.setY(Math.sin(n / 500) / 100);
		contentPlaneHolder.position.setY(Math.sin(n / 500) / 100);
		
		articles.rotation.set(0, Math.sin((n - 500) / 500) / 150, 0, 'XYZ');
	
		if(sceneModel.state.logicUpdate || sceneModel.state.newStateReceived) {
			checkVisibility();
			sceneModel.state.logicUpdate = false;
			sceneModel.state.newStateReceived = false;
		}
		if(backgroundVideoSphereTexture) {
			
			if(backgroundVideoSphereTexture.vr.video.paused) { 
				backgroundVideoSphereTexture.vr.video.play();
			}
			var videoState = backgroundVideoSphereTexture.vr.video.readyState
			if ( videoState === backgroundVideoSphereTexture.vr.video.HAVE_ENOUGH_DATA ) {
				backgroundVideoSphereTexture.vr.context.drawImage( 
					backgroundVideoSphereTexture.vr.video, 0, 0 
				);
				backgroundVideoSphereTexture.needsUpdate = true;	
			}
		}
		handleSelection();
		controls.update();
		requestAnimationFrame(animate);
	}
	
	var handleQRTrackerObjects = function() {
		
		
		for(i = 0; i < sceneModel.state.inputDevices.local.qrTrackers.length; i++) {
			
			var m = sceneModel.state.inputDevices.local.qrTrackers[i];
			
			if(typeof webcam.markers.QRMarkerObjects[i] == 'undefined') {
				
				var cube = new THREE.Mesh(
				  new THREE.BoxGeometry(0.07,0.07,0.07),
				  new THREE.MeshNormalMaterial({color: 0xffffff, side: THREE.DoubleSide})
				);
				cube.position.z = -0.035;
				var markerRoot = new THREE.Object3D();
				markerRoot.add(cube);
				markerRoot.matrixAutoUpdate = false; 
				webcamScene.add(markerRoot);
				webcam.markers.QRMarkerObjects.push(markerRoot);
					
			}
			webcam.markers.QRMarkerObjects[i].visible=true;
			webcam.markers.QRMarkerObjects[i].matrix.set(
				m[0], m[1], m[2], m[3],
				m[4], m[5], m[6], m[7],
				m[8], m[9], m[10], m[11],
				m[12], m[13], m[14], m[15]
			);
			webcam.markers.QRMarkerObjects[i].matrixWorldNeedsUpdate = true;
		}
		// Hide lost markers
		for(var i = 0; i < webcam.markers.QRMarkerObjects.length; i++) {
			if(typeof sceneModel.state.inputDevices.local.qrTrackers[i] == 'undefined') {
				if(webcam.markers.QRMarkerObjects[i].visible) webcam.markers.QRMarkerObjects[i].visible=false;
			}
		}
		
	}
	
	var handleSelection = function() {
		
		var rayOrigin = new THREE.Vector2(0, 0);
		if(!VRIsSupported)  {
			rayOrigin = new THREE.Vector2(mouseXPos, mouseYPos);
		}
		
		raycaster.setFromCamera( rayOrigin, camera );	
		var intersects = raycaster.intersectObjects( linkObjects, false ); 
		
		var d = new Date(); 
		var currentTime = d.getTime();
		
		var selectedObject = null;
		var intersectionPoint = null;
		MENU_ITEM_SCALE_CHANGE = 1.3;
		MENU_SELECTION_DELAY;
		
		if(intersects.length > 0) {
			for(var i = 0; i < intersects.length; i++) {
				if(intersects[i].object.parent.getObjectByName("mesh").visible) {
					selectedObject = intersects[i].object;
					intersectionPoint = intersects[i].point;
					break;
				}
			}
		}
		
		if(selectedObject == null) {
			if(activeMenuItem.object != null) {
				activeMenuItem.object.scale.divideScalar(MENU_ITEM_SCALE_CHANGE);
				var cursor = threeJsScene.getObjectByName("cursorSphere");
				if(cursor) threeJsScene.remove(cursor);
				cursorSphere.material.color.setHex(0xff0000);
				cursorSphere.scale.set(1,1,1);
			}
			activeMenuItem.object = null;
			activeMenuItem.selectionStartTime = 0;
		}
		else if(activeMenuItem.object != selectedObject) {
			if(activeMenuItem.object != null) {
				activeMenuItem.object.scale.divideScalar(MENU_ITEM_SCALE_CHANGE);
			}
			selectedObject.linkTriggered = false;
			cursorSphere.position.set(
				intersectionPoint.x, 
				intersectionPoint.y, 
				intersectionPoint.z
			);
			threeJsScene.add(cursorSphere);
			selectedObject.scale.multiplyScalar(MENU_ITEM_SCALE_CHANGE);
			activeMenuItem.object = selectedObject;
			activeMenuItem.selectionStartTime = currentTime;
		}
		else if(activeMenuItem.object == selectedObject) {
			cursorSphere.position.set(intersectionPoint.x, intersectionPoint.y, intersectionPoint.z);
			var selectionProgress = currentTime - activeMenuItem.selectionStartTime;
			var colorPercentage = (selectionProgress /  MENU_SELECTION_DELAY);
			
			
			if(selectionProgress > MENU_SELECTION_DELAY) {
				if(!selectedObject.linkTriggered) {
					triggerAction(activeMenuItem.object.parent);
					selectedObject.linkTriggered = true;
					//cursorMaterial.color.setRGB(1,0,1);
				}
	
			}
			else {
				var cursorScale = (1 + colorPercentage * 5);
				cursorSphere.scale.set(cursorScale, cursorScale, cursorScale);
				cursorSphere.material.color.setRGB(1 - colorPercentage,colorPercentage,0);
			}
		}
			
	}
	
	var triggerAction = function(Object3D) {
		
		switch(Object3D.vr.type) {
			case "link":
				sceneModel.state.navigation.selections.linkSelected = Object3D.vr.index;
			break;
			case "article":
				sceneModel.state.navigation.selections.articleSelected = Object3D.vr.index;
			break;
			case "content":
				sceneModel.state.navigation.selections.contentSelected = Object3D.vr.index;
			break;
			case "toggleHud":
				sceneModel.state.hudVisible = !sceneModel.state.hudVisible;
				checkVisibility();
			break;
			case "toggleWebcam":
				webcam.image.webcameraImagePlane.visible = !webcam.image.webcameraImagePlane.visible;
			break;
			case "back":
				sceneModel.state.navigation.selections.backSelected = true;
			break;
			
		}
		
	}
	
	var checkVisibility = function() {
		
		var links = threeJsScene.getObjectByName( "links" ).children;
		var articles = threeJsScene.getObjectByName( "articles" ).children;
		var footer = threeJsScene.getObjectByName( "footer" );
		var header = threeJsScene.getObjectByName( "header" );
		var backSphere = threeJsScene.getObjectByName( "backSphere" );
		var toggleWebcamSphere = threeJsScene.getObjectByName( "toggleWebcamSphere");
		
		// Everything except hud toggle button if hud disabled
		if(!sceneModel.state.hudVisible)  {
			for(var i = 0; i < links.length; i++) hideShowObjectAndContents(links[i], false, false, -1, -1);	
			for(var i = 0; i < articles.length; i++) hideShowObjectAndContents(articles[i], false, false, -1, -1);	
			footer.visible = false;
			header.visible = false;
			backSphere.visible = false;
			contentPlane.visible = false; // Global variable
			toggleWebcamSphere.visible = false;
		}
		else {
			var currentArticleIndex = sceneModel.state.navigation.index.currentIndex[0];
			var currentContentIndex = sceneModel.state.navigation.index.currentIndex[1];
			
			// Hide link, header and footer when single content activated
			if(currentContentIndex != -1) {
				contentPlane.visible = true;
				for(var i = 0; i < links.length; i++) {
					hideShowObjectAndContents(links[i], false, false, -1, -1);	
				}
				footer.visible = false;
				header.visible = false;
			}
			else {
				for(var i = 0; i < links.length; i++) {
					hideShowObjectAndContents(links[i], true, true, -1, -1);	
				}
				footer.visible = true;
				header.visible = true;
			}
			
			backSphere.visible = true;
			toggleWebcamSphere.visible = true;
			// If current index is -1, show all articles
			if(currentArticleIndex == -1) {
				for(var i = 0; i < articles.length; i++) {
					hideShowObjectAndContents(articles[i], true, false, -1, -1);
					handleBackgroundForeground(null); // Reset background sphere
				}
			}
			else {
				// Otherwise, if -1 content index, show content of currently selected article
				// if not -1, show the selected content
				for(var i = 0; i < articles.length; i++) {
					if(currentArticleIndex == articles[i].vr.index) { 
						hideShowObjectAndContents(
							articles[i], 
							false, 
							true, 
							currentContentIndex, 
							currentArticleIndex
						);
					}
					else { 
						hideShowObjectAndContents(
							articles[i], 
							false, 
							false, 
							currentContentIndex, 
							currentArticleIndex
						);
					}
				}
			}
		}
	}	
	
	var hideShowObjectAndContents = function(
		object, 
		showObject, 
		showContents, 
		currentContentIndex, 
		currentArticleIndex)
		{
		
		setObjectVisibility(object, showObject);
		if(object.vr.type == "article" && object.vr.index == currentArticleIndex) {
				if(sceneModel.state.logicUpdate || sceneModel.state.newStateReceived) activateArticle(object);
			}
		var contents = object.getObjectByName("contents");
		if(contents) {
			for(j = 0; j < contents.children.length; j++) {
				if(showContents && (currentContentIndex == -1 || currentContentIndex == j)) {
					if(currentContentIndex != -1 && contents.children[j].vr.type == "content") {
						if(sceneModel.state.logicUpdate || sceneModel.state.newStateReceived) activateContent(contents.children[j]);
						setObjectVisibility(contents.children[j], false);
					} else {
						contentPlane.visible = false;
						setObjectVisibility(contents.children[j], true);
					}
				}
				else {
					setObjectVisibility(contents.children[j], false);
				}
			}
		}
	}
	
	var setObjectVisibility = function(object, isVisible) {
		var objectMesh = object.getObjectByName("mesh");
		var objectLinkSphere = object.getObjectByName("linkSphere");
		objectMesh.visible = isVisible;
		objectLinkSphere.visible = isVisible;
	}
	
	var activateArticle = function(article) {
		var element = article.vr.element;
		handleBackgroundForeground(element);
	}
	var activateContent = function(content) {
		var element = content.vr.element;
		VRSceneBuilder.handleContentPlane(element, contentPlane);
		// Use article background
		handleBackgroundForeground(element);
	}
	
	
	
	var handleBackgroundForeground = function(element) {
		
		// Foreground
		// TODO
		
		// Background
		
		if(backgroundVideoSphereTexture) {
			backgroundVideoSphereTexture.vr.video.pause();
			backgroundVideoSphereTexture = null;
		}
		if(element) {
			if(element.backgroundElement.image) {
				var newTexture = THREE.ImageUtils.loadTexture( element.backgroundElement.image.source );
				newTexture.minFilter = THREE.LinearFilter;
				backgroundSphere.material = new THREE.MeshBasicMaterial( {map: newTexture } );
			}
			else if(element.backgroundElement.video) {
				var videoWidthInPixels = element.backgroundElement.video.width;
				var videoHeightInPixels = element.backgroundElement.video.height;
				var videoTexture = Utils.getVideoTexture(
					element.backgroundElement.video.source, 
					videoWidthInPixels, videoHeightInPixels
				);
				backgroundSphere.material = new THREE.MeshBasicMaterial( 
					{
						map: videoTexture, 
						overdraw: true
					} 
				);
				backgroundVideoSphereTexture = videoTexture;
			}
			else {
				backgroundSphere.material = new THREE.MeshBasicMaterial( {color: HOME_PAGE_COLOR} );
			}
		}
		else { 
			backgroundSphere.material = new THREE.MeshBasicMaterial( {color: HOME_PAGE_COLOR} );
		}
		// TODO: Object background
	}
	
	VRGraphicsEngine.makeObjectALink = function(Object3D) {
		var linkSphereGeom =  new THREE.SphereGeometry( 0.040, 20, 10 );
		var transparentMaterial = new THREE.MeshBasicMaterial(
			{ 
				color: 0xcccccc, 
				transparent: true, 
				opacity: 0.65 }
			);
		var linkSphere = new THREE.Mesh( linkSphereGeom, transparentMaterial );
		if(typeof Object3D.vr.width == 'undefined')  
			linkSphere.position.set(0, 0, 0);
		else
			linkSphere.position.set(Object3D.vr.width / 2, Object3D.vr.height / 2, 0);
		
		linkSphere.name = "linkSphere";
		linkObjects.push(linkSphere);
		Object3D.add(linkSphere);
	}

	
}(VRGraphicsEngine, THREE, screen, window));