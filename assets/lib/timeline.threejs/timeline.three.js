function TJSTIMELINE( properties )
{
	var context = this;
	this.version = "1.0";
	this.uuid = WEB_UTILS.generateUUID();
	// # CHECK IF CONTAINER WAS GIVEN - Do I really need this?
	if( !properties.hasOwnProperty("container") )
	{
		printError( TJSTIMELINE.ERROR.NO_CONTAINER );
		return;
	}

	// # INITIALIZE ATTRIBUTES FROM PROPERTIES
	var container = properties.container;
	var id4JQ = "#"+container.getAttribute("id"); // id for jquery
	var containerWidth = (properties.hasOwnProperty("width"))? properties.width : container.clientWidth;
	var containerHeight = (properties.hasOwnProperty("height"))? properties.height : container.clientHeight;
	this.width = containerWidth;
	this.height = containerHeight;
	var labelDivision = (properties.hasOwnProperty("labelDivision"))? properties.labelDivision : 0.20;
	var rulerDivision = (properties.hasOwnProperty("rulerDivision"))? properties.rulerDivision : 0.05;
	this.ldiv = labelDivision; // lazyness I know
	this.rdiv = rulerDivision; // lazyness I know
	var margin = (properties.hasOwnProperty("margin"))? properties.margin : 5;
	var lineHighlightStyleParams = (properties.hasOwnProperty("hlineParams"))? properties.hlineParams : {color: 0xffa500, linewidth: 3};
	
	var anchorPoint = new THREE.Vector2(-containerWidth/2, containerHeight/2);
	this.baseAttribute = (properties.hasOwnProperty("baseAttribute"))? properties.baseAttribute : null;
	this.baseAttributeMax = -1;
	this.baseAttributeMin = -1;

	this.startTime = (properties.hasOwnProperty("startTime"))? properties.startTime : null;
	this.endTime = (properties.hasOwnProperty("endTime"))? properties.endTime : null;
	this.timeStep = (properties.hasOwnProperty("timeStep"))? properties.timeStep : null;
	this.firstTimeAxis = (properties.hasOwnProperty("firstTimeAxis"))? properties.firstTimeAxis : null;
	this.temporalUnity = (properties.hasOwnProperty("temporalUnity"))? properties.temporalUnity : null;
	
	// ---
	var defaultFormatTimestamp = function( timestamp )
	{		
		var text = "";
		if( timestamp === -1 ) text = "n/a";
		else
		{
			var date = new Date( timestamp *1000 );
			text =  
			((date.getDate() < 10 )? "0"+date.getDate() : date.getDate() )+"/"+( (date.getMonth()+1 < 10)? "0"+(date.getMonth()+1) : (date.getMonth()+1) )+"/"+(date.getFullYear()) +
			"<br>"+( (date.getHours() < 10)? "0"+(date.getHours()) : (date.getHours()) ) +":"+ ((date.getMinutes() < 10)? "0"+(date.getMinutes()) : (date.getMinutes() ));
		}			
		return text;		
	};
	this.formatTimestamp = (properties.hasOwnProperty("formatTimestamp"))? properties.formatTimestamp : defaultFormatTimestamp;
	// ---
	var defaultValueFormat = function( value )
	{
		return value+"";
	};
	this.formatValue = (properties.hasOwnProperty("formatValue"))? properties.formatValue : defaultValueFormat;
	
	// # SET THREE JS SCENE 
	var renderer, labelCamera, rulerCamera, dataCamera;		
	// renderer
	renderer = new THREE.WebGLRenderer( {alpha: true, antialias: true} );
	renderer.setSize( containerWidth, containerHeight );
	renderer.setClearColor( 0xffffff, 1 );
	renderer.autoClear = false;	
	container.appendChild( renderer.domElement );
	this.rend = renderer;
	// scene
	this.scene = new THREE.Scene();
	// cameras	
    labelCamera = new THREE.OrthographicCamera( 
		containerWidth/-2, 
		(containerWidth/-2)+(containerWidth*labelDivision)/2 -2, 
		containerHeight/2 -(containerHeight*rulerDivision)-2, 
		containerHeight/-2 , -100, 100 );        

    dataCamera = new THREE.OrthographicCamera( 
		(containerWidth/-2)+(containerWidth*labelDivision), 
		containerWidth/2, 
		containerHeight/2 -(containerHeight*rulerDivision)-2, 
		containerHeight/-2 , -100, 100 );        

    rulerCamera = new THREE.OrthographicCamera( 
		containerWidth/-2+(containerWidth*labelDivision), 
		containerWidth/2, 
		containerHeight/2, 
		containerHeight/2-(containerHeight*rulerDivision)-2 , -100, 100 );

    // boundaries for interaction
	var leftLimit = (containerWidth/-2)+(containerWidth*labelDivision);
	var rightLimit = containerWidth/2;
	var topLimit = containerHeight/2 -(containerHeight*rulerDivision)-2;
	var bottomLimit = -containerHeight/2; // this one can change

	// objects
	var rulerObjects = [];
	var rulerPlane;	
	var mousePlaneTest;
	var highlightLine, graphHighlightLine;
	var graphDataPlane, graphLabelPlane;
	var zoomPlaneFeedbackLeft, zoomPlaneFeedbackRight;

	this.timelineLayers = [];
	this.highlightLayers = [];
	var updateTimeline = false;
	var currentLayerHighlight = null;
	
	// functions/events
	this.onTimelineMouseDoubleClick = function( eventParams ){};	//	console.log( "mouseDoubleClick", eventParams ); };
	this.onTimelineMouseClick = function( eventParams ){};			//	console.log( "mouseClick", eventParams ); };
	this.onTimelineMouseDown = function( eventParams){};			//	console.log( "mouseDown", eventParams ); };
	this.onTimelineMouseRelease = function( eventParams){};			//	console.log( "mouseRelease", eventParams ); };
	this.onTimelineMouseHover = function( eventParams ){};			//	console.log( "--" ); };//"mouseHover", eventParams ); };
	this.onTimelineMouseOut = function( eventParams ){};			//	console.log( "mouseOut", eventParams ); };

	this.onTimelineMouseHoverStop = function( eventParams ){}; 	// console.log( "--" ); };//"mouseHover", eventParams ); };

	// # SET INTERACTIVE EVENTS	
	var mostRecentEventParams = null;
	var mouseOnElement = false;
	var mouse = new THREE.Vector2();
	var MOUSE_NOT_CLICKING = 0;
	var MOUSE_LEFT_CLICKING = 2;
	var MOUSE_RIGHT_CLICKING = 2;
	var mouseClicking = MOUSE_NOT_CLICKING;
	var draggingPosition = new THREE.Vector2();
	var timeMouseClicking;
	var MIN_TIME_FOR_MOUSE_RELEASE = 100;	
	
	var raycaster = new THREE.Raycaster();
	var zoomLevel = 1;
	var zoomScale = 0.025;

	this.timelineUniforms = { 
		color: { type: "c", value: new THREE.Color( 0xffffff ) },
		tfocus: { type: "i", value: false },
		tstart: { type: "i", value: 0 },
		tend: { type: "i", value: 0 }
	};

	$(window).on('resize', function(){ onWindowResize(); } );

	$(id4JQ).bind( 'mousewheel', function(ev)
	{
		if( mouseOnElement )
		{
			ev.preventDefault();
			if( ev.originalEvent.wheelDelta > 0 ) // sup			
				context.zoomIn();			
			else // sdown			
				context.zoomOut();			
		}
	});

	$(id4JQ)
	.mouseenter( function(ev){ mouseOnElement = true; })
	.mouseleave( function(ev){ 
		highlightLine.currentTime = -1; 
		updateHLine(); 
		mouseOnElement = false; 

		if( mostRecentEventParams !== null && mostRecentEventParams.layer !== null ) 
		{
			mostRecentEventParams.layer.removeHighlight();			
			context.onTimelineMouseHoverStop();
			context.render();
		}

		context.onTimelineMouseOut( null );
	})
	.dblclick( function(ev){ 
		context.onTimelineMouseDoubleClick( mostRecentEventParams );
	})
	.mousedown( function( ev ){	onMouseDown( ev ); })
	.mousemove( function(ev){ onMouseMove( ev ); })
	.mouseup( function(ev){
			if( mouseClicking === MOUSE_RIGHT_CLICKING )			
			{
				ev.preventDefault();
				context.onTimelinePanStop({
					type: "pan_end",
					timeWindow: [ context.timeline2timestamp( dataCamera.left ), 
							context.timeline2timestamp( dataCamera.right ) ]
				});
			}
			
			if( ev.which === 1 ) // left button
			{
				var totalTimeMouseClicking = ( Date.now() - timeMouseClicking ); //console.log( "~~~>", totalTimeMouseClicking ); 
				if( totalTimeMouseClicking >= MIN_TIME_FOR_MOUSE_RELEASE )
					context.onTimelineMouseRelease( mostRecentEventParams );
				else
					context.onTimelineMouseClick( mostRecentEventParams );
			}
			
			mouseClicking = MOUSE_NOT_CLICKING;			
	})
	.on( "contextmenu", function(){ return false; } );	
	
	// ---
	this.onTimelinePanStart = function( event ){ };
	
	// ---
	this.onTimelinePanStop = function( event ){ };

	this.updateTemporalFocus = function( temporalFocus, start, end )
	{
		this.timelineUniforms.tfocus.value = temporalFocus;
		this.timelineUniforms.tstart.value = start;
		this.timelineUniforms.tend.value = end;

		this.render();
	};
	
	// ---
	var testDragging = function( ev )
	{
		if( mouseOnElement )
		{
			if( ev.which === 1 ) // left click
			{
				if( mouseClicking !== MOUSE_LEFT_CLICKING)
					context.onTimelineMouseDown( mostRecentEventParams );
				mouseClicking = MOUSE_LEFT_CLICKING;
				timeMouseClicking = Date.now();					
			}
			if( ev.which === 3 ) // right click
			{
				var newLeft = dataCamera.left - (ev.pageX-draggingPosition.x)/(zoomLevel*0.5);
	            var newRight = dataCamera.right - (ev.pageX-draggingPosition.x)/(zoomLevel*0.5);

	            var newUp = dataCamera.top + (ev.pageY-draggingPosition.y)/(zoomLevel*0.5);
	            var newDown = dataCamera.bottom + (ev.pageY-draggingPosition.y)/(zoomLevel*0.5);

	            if( newLeft <= leftLimit )
	            {
					newRight = leftLimit + (newRight-newLeft);
					newLeft = leftLimit;
					zoomPlaneFeedbackLeft.material.opacity = 0;
	            }
	            else 
	            {
	            	zoomPlaneFeedbackLeft.material.opacity = 0.5;
	            }

	            if( newRight >= rightLimit )
	            {
					newLeft = rightLimit - (newRight-newLeft);
					newRight = rightLimit;
					zoomPlaneFeedbackRight.material.opacity = 0;
	            }
	            else
	            {
	            	zoomPlaneFeedbackRight.material.opacity = 0.5;
	            }

	            if( newUp > topLimit )
	            {
	            	newDown = topLimit + (newDown-newUp);
	            	newUp = topLimit;
	            }
	            else if( newDown < bottomLimit )
	            {
	            	newUp = bottomLimit - (newDown-newUp);
					newDown = bottomLimit;
	            }

	            labelCamera.top = dataCamera.top = newUp;
	            labelCamera.bottom = dataCamera.bottom = newDown;
	            rulerCamera.left = dataCamera.left = newLeft;
	            rulerCamera.right = dataCamera.right = newRight;

				zoomPlaneFeedbackLeft.material.needsUpdate = true;
				zoomPlaneFeedbackRight.material.needsUpdate = true;
	            zoomPlaneFeedbackLeft.position.x = newLeft+margin/2;
	            zoomPlaneFeedbackRight.position.x = newRight-margin/2;

	            labelCamera.updateProjectionMatrix();
	            rulerCamera.updateProjectionMatrix();
	            dataCamera.updateProjectionMatrix();
				
				context.render();

	            draggingPosition.x = ev.pageX;
	            draggingPosition.y = ev.pageY;

	            if( mouseClicking === MOUSE_NOT_CLICKING )
				{
					context.onTimelinePanStart({
						type: "pan_start",
						timeWindow: [ context.timeline2timestamp( dataCamera.left ), 
							context.timeline2timestamp( dataCamera.right ) ]
					});

					mouseClicking = MOUSE_RIGHT_CLICKING;
				}
			}	
		}
		else
			mouseClicking = MOUSE_NOT_CLICKING;
	};

	// ---
	var onMouseMove = function( ev )
	{
		testDragging( ev );
		
		var p = WEB_UTILS.findObjectPosition( container );
		mouse.x = (ev.pageX - (containerWidth/2) - p[0])/(containerWidth/2);
		mouse.y = -(ev.pageY - (containerHeight/2)-p[1])/(containerHeight/2);		

		var rulerMargins = new THREE.Vector2( 
			-1+labelDivision*2, 
			1-( (rulerDivision*containerHeight+2)/containerHeight )*2
		);

		var intersectionType = 0; 
		var camera2Use;
		// 1, 2, 3 - ruler, label, data, respectively

		// if mouse is hovering on the temporal ruler section
		if( mouse.x >= rulerMargins.x && mouse.y >= rulerMargins.y )
		{
			mouse.x = WEB_UTILS.scaleDimension( [rulerMargins.x, 1], [-1, 1], mouse.x );
			mouse.y = WEB_UTILS.scaleDimension( [rulerMargins.y, 1], [-1, 1], mouse.y );

			camera2Use = rulerCamera;
			intersectionType = 1;
		}
		// if mouse is hovering on the label section
		else if( mouse.x < rulerMargins.x && mouse.y < rulerMargins.y )
		{
			mouse.x = WEB_UTILS.scaleDimension( [-1, rulerMargins.x], [-1, 1], mouse.x );
			mouse.y = WEB_UTILS.scaleDimension( [-1, rulerMargins.y], [-1, 1], mouse.y );			

			camera2Use = labelCamera;
			intersectionType = 2;
		}
		// if mouse is hovering on the data section
		else if( mouse.x >= rulerMargins.x && mouse.y < rulerMargins.y )
		{
			mouse.x = WEB_UTILS.scaleDimension( [rulerMargins.x, 1], [-1, 1], mouse.x );
			mouse.y = WEB_UTILS.scaleDimension( [-1, rulerMargins.y], [-1, 1], mouse.y );			

			camera2Use = dataCamera;
			intersectionType = 3;
		}

		if( intersectionType !== 0 )
		{
			var vector = new THREE.Vector3( mouse.x, mouse.y, -1 );		
			vector.unproject( camera2Use );
			var direction = new THREE.Vector3( 0, 0, -1 ).transformDirection( camera2Use.matrixWorld );

			raycaster.set( vector, direction );
			raycaster.linePrecision = 3;
			raycaster.params.Points.threshold = 3;
			var intersects = raycaster.intersectObjects( context.scene.children );
			if( intersects.length > 0 )
			{
				var intersectData = null;
				for( var i = 0; i < intersects.length && intersectData == null; i++ )
					if( !intersects[i].object.hasOwnProperty("currentTime") && !intersects[i].object.hasOwnProperty("currentHeight") && !intersects[i].object.hasOwnProperty("highlight") && !intersects[i].object.hasOwnProperty("isGraphLine")
						&& intersects[i].object.objtype != TJSTIMELINE.UTILS.OBJECT_TYPES.H_TIME_POINT_PARTICLE )
						intersectData = intersects[i]; 

			console.log( "int", intersectionType, intersectData );
				if( intersectData === null ) return;

				var iPoint = intersectData.point;
				var timestamp = context.timeline2timestamp( iPoint.x );
				highlightLine.currentTime = timestamp;				
				
				if( intersectionType == 1 ) // ruler
				{		
					if( mostRecentEventParams !== null && mostRecentEventParams.layer !== null )
					{
						mostRecentEventParams.layer.removeHighlight();			
						context.onTimelineMouseHoverStop();
					} 
					//console.log( "r>>>", new Date(timestamp*1000) );
					var eventParams = {};
					eventParams.zone = TJSTIMELINE.UTILS.ZONE_TYPES.RULER;
					eventParams.layer = layer;
					eventParams.type = TJSTIMELINE.UTILS.OBJECT_TYPES.NONE;					
					eventParams.timestamp = timestamp;
					console.log( "ruler: ", eventParams );
					context.onTimelineMouseHover( eventParams );
				}
				else if( intersectionType == 2 ) // label
				{		
					if( mostRecentEventParams !== null && mostRecentEventParams.layer !== null ) 
					{
						mostRecentEventParams.layer.removeHighlight();			
						context.onTimelineMouseHoverStop();
					} 				
					
					var layer = context.layerByName( intersectData.object.layer );
					var eventParams = {};
					eventParams.zone = TJSTIMELINE.UTILS.ZONE_TYPES.LABEL;
					eventParams.layer = layer;
					eventParams.type = TJSTIMELINE.UTILS.OBJECT_TYPES.NONE;					
					eventParams.timestamp = -1;					
					mostRecentEventParams = eventParams;
					context.onTimelineMouseHover( eventParams );
					highlightLine.currentTime = -1;					
				}
				else if( intersectionType == 3 ) // timeline - data
				{
					if( mostRecentEventParams !== null && mostRecentEventParams.layer !== null ) 
					{
						mostRecentEventParams.layer.removeHighlight();			
						context.onTimelineMouseHoverStop();
					} 

					if( intersectData.object.geometry instanceof THREE.PlaneBufferGeometry )
					{						
						if( intersectData.object.planeType === "timeHelper" )
						{																					
							var layer = context.layerByName( intersectData.object.layer );
							layer.removeHighlight();
							context.onTimelineMouseHoverStop();
							
							var eventParams = {};
							eventParams.layer = layer;
							eventParams.zone = TJSTIMELINE.UTILS.ZONE_TYPES.DATA;
							eventParams.type = TJSTIMELINE.UTILS.OBJECT_TYPES.NONE;
							eventParams.timestamp = timestamp;
							context.onTimelineMouseHover( eventParams );
							mostRecentEventParams = eventParams;
							//graphTimeHighlight
							graphHighlightLine.currentHeight = intersectData.point.y;
						}
						else if( intersectData.object.planeType === "graphBackground" )
						{

							if( mostRecentEventParams !== null && mostRecentEventParams.layer !== null ) 
								mostRecentEventParams.layer.removeHighlight();
							context.onTimelineMouseHoverStop();

							var eventParams = {};
							eventParams.zone = TJSTIMELINE.UTILS.ZONE_TYPES.DATA;
							eventParams.layer = null;
							eventParams.type = TJSTIMELINE.UTILS.OBJECT_TYPES.NONE;					
							eventParams.timestamp = timestamp;
							eventParams.value = (context.baseAttribute !== null)? context.timelineYPos2DataValue( graphHighlightLine.currentHeight ) : null;
							context.onTimelineMouseHover( eventParams );

							graphHighlightLine.currentHeight = Number(intersectData.point.y);
						}
						else
						{
							/* no longer applicable, I suppose...

							var layer = context.layerByName( intersectData.object.layer );
							var data = layer.data;
							var dataIndex = intersectData.object.dpi;
							var period = data[ dataIndex ];
							var periodStyle = layer.styleTimePeriods( data, period, dataIndex );

							var eventParams = {};
							eventParams.zone = TJSTIMELINE.UTILS.ZONE_TYPES.DATA;
							eventParams.layer = layer;
							eventParams.type = intersectData.object.objtype;
							eventParams.dpi = dataIndex;
							eventParams.periodstyle = periodStyle;
							context.onTimelineMouseHover( eventParams );
							mostRecentEventParams = eventParams;

							graphHighlightLine.currentHeight = Number( intersectData.object.position.y );
							
							//removeTemporaryHighlights();

							//if( currentHighlight.feature !== null && currentHighlight.feature.uuid !== intersectData.object.uuid )
							layer.highlightFeature( intersectData.object, dataIndex );
							*/
							
						}
					}
					else if( intersectData.object instanceof THREE.Mesh &&
					 intersectData.object.objtype == TJSTIMELINE.UTILS.OBJECT_TYPES.POLY_PERIOD ) // period label with cylincers
					{
						console.log( "ohmygosh" );
						var layer = context.layerByName( intersectData.object.layer );
						var data = layer.data;
						var dataIndex = intersectData.object.dpi;
						var period = data[ dataIndex ];
						var periodStyle = layer.styleTimePeriods( data, period, dataIndex );

						var eventParams = { 
							zone: TJSTIMELINE.UTILS.ZONE_TYPES.DATA,
							layer: layer,
							type: intersectData.object.objtype,
							dpi: dataIndex,
							periodstyle: periodStyle
						};
						context.onTimelineMouseHover( eventParams );
						mostRecentEventParams = eventParams;

						graphHighlightLine.currentHeight = Number( intersectData.object.position.y );
						
						//removeTemporaryHighlights();
						//if( currentHighlight.feature !== null && currentHighlight.feature.uuid !== intersectData.object.uuid )
						layer.highlightFeature( intersectData.object, dataIndex );

					}
					else if( ( intersectData.object instanceof THREE.Points ||
							 intersectData.object instanceof THREE.PointCloud || 
							 intersectData.object instanceof THREE.ParticleSystem ) 
							&& intersectData.object.objtype !== TJSTIMELINE.UTILS.OBJECT_TYPES.H_TIME_POINT_PARTICLE )
					{						
						var layer = context.layerByName( intersectData.object.layer );						
						var data = layer.data;
						var particleVertex = intersectData.index;
						var dataIndex = intersectData.object.fdpi + particleVertex;
						var dataPoint = data[ dataIndex ];
						var timeMomentStyle = layer.styleTimePoints( data, dataPoint, dataIndex );

						var eventParams = {};
						eventParams.zone = TJSTIMELINE.UTILS.ZONE_TYPES.DATA;
						eventParams.layer = layer;
						eventParams.type = intersectData.object.objtype;
						eventParams.dpi = dataIndex;
						eventParams.momentstyle = timeMomentStyle;

						layer.highlightFeature( intersectData.object, dataIndex, particleVertex );
						context.onTimelineMouseHover( eventParams );
						mostRecentEventParams = eventParams;

						//data[dataIndex].attributes[ context.timeline.baseAttribute ];

						graphHighlightLine.currentHeight = Number( context.dataValue2TimelineYPos( data[dataIndex].attributes[context.baseAttribute]) );

						//console.log( "--->", intersectData.object.geometry.attributes.position.array[particleVertex*3], particleVertex, graphHighlightLine.currentHeight );
					}
					else if( intersectData.object.objtype == TJSTIMELINE.UTILS.OBJECT_TYPES.LINE &&
						 intersectData.object instanceof THREE.Line && 
						!intersectData.object.hasOwnProperty("currentTime") && 
						!intersectData.object.hasOwnProperty("currentHeight") && 
						!intersectData.object.hasOwnProperty("isGraphLine") )
					{
						//
						var layer = context.layerByName( intersectData.object.layer );
						var data = layer.data;
						var dpiArray = intersectData.object.geometry.attributes.dpi.array;

						//console.log( "~~~~>>>", intersectData );

						var lineVertex = intersectData.vertex;
						var lineVertex2 = lineVertex+1;
						var dataIndex = dpiArray[ intersectData.index ]; //intersectData.object.geometry.vertices[lineVertex].dpi;
						var dataIndex2 = dpiArray[ intersectData.index+1 ]; //intersectData.object.geometry.vertices[lineVertex2].dpi;
						var linkStyle = layer.styleFeatureLinks( data, data[dataIndex], dataIndex, dataIndex2 );

						var eventParams = {};
						eventParams.zone = TJSTIMELINE.UTILS.ZONE_TYPES.DATA;
						eventParams.layer = layer;
						eventParams.type = intersectData.object.objtype;
						eventParams.dpi = dataIndex;
						eventParams.dpi2 = dataIndex2;
						eventParams.linkstyle = linkStyle;
						eventParams.timelinePoint = intersectData.point;
						
						layer.highlightFeature( intersectData.object, dataIndex, dataIndex2, intersectData.point );
						context.onTimelineMouseHover( eventParams );
						mostRecentEventParams = eventParams;
					}
				}
				else if( mostRecentEventParams !== null && mostRecentEventParams.layer !== null ) 
				{
					mostRecentEventParams.layer.removeHighlight();	
					context.onTimelineMouseHoverStop();
				}
				updateHLine();								
			}
			else if( mostRecentEventParams !== null && mostRecentEventParams.layer !== null )
			{
				mostRecentEventParams.layer.removeHighlight();
				context.onTimelineMouseHoverStop();
			}
			context.render();
		}
	};
	
	var addTimeLabel = function()
	{
		if( $( "#timelinejs_label"+context.uuid).length )
		{
			// setTimeBoundaries
			return;
		}

		var div = document.createElement( "div" );
		div.setAttribute( "id", "timelinejs_label"+context.uuid  );
		div.setAttribute( "name", "timelinejs_label" );		
		div.style.position = 'absolute';
		div.className += " timelineTextSection";
					
		// default style?
		div.style.backgroundColor = "white";		
		div.style.borderRadius = "3px";
		//div.style.border = "1px solid black";
		div.style.fontSize = "0.9em";
		div.style.fontFamily = "Arial,sans-serif";
		div.style.opacity = "0.9";
		div.style.textAlign = "center";
		div.style.height = rulerDivision*containerHeight+"px";
		div.style.width = labelDivision*containerWidth+"px";				
		
		div.innerHTML = "<b>n/a</b>";
		
		var pos = WEB_UTILS.findObjectPosition( container );
		
		div.style.left = (pos[0]+1)+"px";
		div.style.top =  (pos[1]+1)+"px";
		
		div.style.visibility = "visible";
		container.appendChild( div );	
	};
	

	// ---
	var onMouseDown = function( ev )
	{
		if( ev.which === 3 ) // right button
		{
			draggingPosition.x = ev.pageX;
			draggingPosition.y = ev.pageY;
		}		
	};

	// ---
	this.onTimelineZoom = function( event ){
	};

	// ---
	this.zoomIn = function()
	{	
		zoomLevel += 1;
		var newLeft = dataCamera.left + Math.abs( rightLimit-leftLimit )*zoomScale;
		var newRight = dataCamera.right - Math.abs( rightLimit-leftLimit )*zoomScale;	

		//console.log( "zin", zoomLevel, newLeft, newRight );

		if( Math.abs(newLeft - newRight) <= 1 )
		{
			zoomLevel -= 1;
			return;
		}

		if( newLeft <= leftLimit )
		{
			newRight = leftLimit + ( newRight-newLeft );
			newLeft = leftLimit;
			zoomPlaneFeedbackLeft.material.opacity = 0;
		}
		else 
			zoomPlaneFeedbackLeft.material.opacity = 0.5;

		if( newRight >= rightLimit )
		{
			newLeft = rightLimit - ( newRight-newLeft );
			newRight = rightLimit;
			zoomPlaneFeedbackRight.material.opacity = 0;
		}
		else
		{
			zoomPlaneFeedbackRight.material.opacity = 0.5;
		}

		zoomPlaneFeedbackLeft.material.needsUpdate = true;
		zoomPlaneFeedbackRight.material.needsUpdate = true;
		zoomPlaneFeedbackLeft.position.x = newLeft+margin/2;
		zoomPlaneFeedbackRight.position.x = newRight-margin/2;

		dataCamera.left = rulerCamera.left = newLeft;
		dataCamera.right = rulerCamera.right = newRight;
		dataCamera.updateProjectionMatrix();
		rulerCamera.updateProjectionMatrix();		

		if( dataCamera.left === leftLimit || dataCamera.right === rightLimit )
			zoomLevel -= 1;
		this.render();	

		this.onTimelineZoom({
			type: "zoomIn",
			zoomLevel: zoomLevel
		});	
	};

	// ---
	this.zoomOut = function()
	{		
		if( zoomLevel === 1 ) return;
		zoomLevel -= 1;

		var newLeft = dataCamera.left - Math.abs( rightLimit-leftLimit )*zoomScale;
		var newRight = dataCamera.right + Math.abs( rightLimit-leftLimit )*zoomScale;

		if( newLeft <= leftLimit )
		{
			newRight = leftLimit + ( newRight-newLeft );
			newLeft = leftLimit;
			zoomPlaneFeedbackLeft.material.opacity = 0;
		}
		else 
			zoomPlaneFeedbackLeft.material.opacity = 0.5;

		if( newRight >= rightLimit )
		{
			newLeft = rightLimit - ( newRight-newLeft );
			newRight = rightLimit;
			zoomPlaneFeedbackRight.material.opacity = 0;
		}
		else
			zoomPlaneFeedbackRight.material.opacity = 0.5;
		
		zoomPlaneFeedbackLeft.material.needsUpdate = true;
		zoomPlaneFeedbackRight.material.needsUpdate = true;
		zoomPlaneFeedbackLeft.position.x = newLeft+margin/2;
		zoomPlaneFeedbackRight.position.x = newRight-margin/2;

		dataCamera.left = rulerCamera.left = newLeft;
		dataCamera.right = rulerCamera.right = newRight;
		dataCamera.updateProjectionMatrix();
		rulerCamera.updateProjectionMatrix();		

		this.render();

		this.onTimelineZoom({
			type: "zoomOut",
			zoomLevel: zoomLevel
		});	
	};

	// ---
	this.removeTimeline = function()
	{
		while( this.scene.children.length != 0 )
			this.scene.remove( this.scene.children[0] );

		this.rulerObjects = [];
		this.scene.remove( highlightLine, graphHighlightLine );

		this.render();
		//$( "#timelinejs_label"+this.uuid ).remove();
	};


	var setDefaultTemporalUnity = function()
	{
		//if( ("end" in context.boundingBox()) && ("start" in context.boundingBox()) )
		{
			var deltaTime = ( context.endTime - context.startTime );
			
			if( deltaTime >= 1.5*TJSTIMELINE.UTILS.TIME_FLAGS.ONE_MONTH )
				context.temporalUnity = TJSTIMELINE.UTILS.TIME_FLAGS.ONE_MONTH;
			else if( deltaTime >= TJSTIMELINE.UTILS.TIME_FLAGS.ONE_WEEK )
				context.temporalUnity = TJSTIMELINE.UTILS.TIME_FLAGS.ONE_WEEK;
			else if( deltaTime >= 2*TJSTIMELINE.UTILS.TIME_FLAGS.ONE_DAY )
				context.temporalUnity = TJSTIMELINE.UTILS.TIME_FLAGS.ONE_DAY;
			else //if( deltaTime >= STCJS.UTILS.TIME_FLAGS.ONE_HOUR )
				context.temporalUnity = TJSTIMELINE.UTILS.TIME_FLAGS.ONE_HOUR;
			//else
				//context.stc.timeAxesUnit = deltaTime/5; // default division : 5 lines			
		}
	};

	var setDefaultFirstAxis = function()
	{
		var startTimestamp = new Date( context.startTime * 1000 );
		if( context.temporalUnity >= TJSTIMELINE.UTILS.TIME_FLAGS.ONE_MONTH )
			startTimestamp.setMonth( startTimestamp.getMonth()+1 );
		else if( context.temporalUnity >= TJSTIMELINE.UTILS.TIME_FLAGS.ONE_WEEK )
			startTimestamp.setHours(24); // may need to change later
		else if( context.temporalUnity >= TJSTIMELINE.UTILS.TIME_FLAGS.ONE_DAY )
			startTimestamp.setHours(24);
		else if( context.temporalUnity >= TJSTIMELINE.UTILS.TIME_FLAGS.ONE_HOUR )
			startTimestamp.setMinutes(60);
		
		console.log( startTimestamp );
		context.firstTimeAxis = startTimestamp.getTime()/1000;
	};

	// ---
	this.drawTimeline = function()
	{
		mostRecentEventParams = null;
		addTimeLabel();
		// drawRuler ---
		var rulerHeight = (containerHeight*rulerDivision)-margin;
		
		//startRulerPoint
		var srp = new THREE.Vector3(  
			anchorPoint.x+(labelDivision*containerWidth)+margin,
			anchorPoint.y-margin-rulerHeight/2, 0 );
		//endRulerPoint
		var erp = new THREE.Vector3( 
			containerWidth/2-margin,
			anchorPoint.y-margin-rulerHeight/2, 0 );

		var lineMaterial = new THREE.LineBasicMaterial( {color: 0x000000, linewidth: 3} );
		//lineMaterial.type = THREE.Lines;
		var numberSteps = (this.endTime-this.startTime)/this.timeStep;
				
		var geometry = new THREE.Geometry();
		geometry.vertices.push( srp );
		geometry.vertices.push( erp );
		var line = new THREE.Line( geometry, lineMaterial );
		this.scene.add( line );
		rulerObjects.push( line );

		// -----------------------------------------------
		// draw ruler 2
		if( this.baseAttribute !== null )
		{
			var sr2p = new THREE.Vector3(
				anchorPoint.x +(this.width*this.ldiv)*0.45, 
				dataCamera.top*0.9, -1 );
			var er2p = new THREE.Vector3(
				anchorPoint.x +(this.width*this.ldiv)*0.45,
				dataCamera.bottom*0.9, -1 );

			var lineMaterial2 = new THREE.LineBasicMaterial( {color: 0xff0000, linewidth: 3} );
			numberSteps /= 2;
			for( var i = 0; i <= numberSteps; i++ )
			{		 
				var geometry2 = new THREE.Geometry();
				geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width*this.ldiv)*0.4, (sr2p.y)+(i*(er2p.y-sr2p.y)/numberSteps), 1 ) );
				geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width), (sr2p.y)+(i*(er2p.y-sr2p.y)/numberSteps), 1 ) );
				var line2 = new THREE.Line( geometry2, lineMaterial2 );
				line2.isGraphLine = true;
				this.scene.add( line2 );
				rulerObjects.push( line2 );
			}
			
			var geometry2 = new THREE.Geometry();
			geometry2.vertices.push( sr2p );
			geometry2.vertices.push( er2p );
			var line3 = new THREE.Line( geometry2, lineMaterial2 );
			line3.isGraphLine = true;
			this.scene.add( line3 );
			rulerObjects.push( line3 );

			//
			graphDataPlane = new THREE.Mesh(
				new THREE.PlaneBufferGeometry( containerWidth-(containerWidth*labelDivision), containerHeight-(containerHeight*rulerDivision) ), 
				new THREE.MeshBasicMaterial( {color: 0xff0000, transparent: true, opacity: 0} ));
			graphDataPlane.overdraw = true;
			graphDataPlane.position.set( 0+((containerWidth*labelDivision)/2), -(containerHeight*rulerDivision), -7);
			graphDataPlane.planeType = "graphBackground";
			this.scene.add(graphDataPlane);

			// graphLabelPlane
			graphLabelPlane = new THREE.Mesh(
				new THREE.PlaneBufferGeometry( 1, 1),					
				new THREE.MeshBasicMaterial( {color: 0xffffff, transparent: true, opacity: 1} ));
			graphLabelPlane.overdraw = true;
			graphLabelPlane.scale.x = this.width * this.ldiv*0.45;
			graphLabelPlane.scale.y = containerHeight*rulerDivision*1.5;
			graphLabelPlane.position.set( 
				-this.width/2-1 + (graphLabelPlane.scale.x)/2+1, 
				anchorPoint.y, 
				-1 );
			graphLabelPlane.planeType = "graphTimeHighlight";
			this.scene.add( graphLabelPlane );
		}

		// drawAuxiliarPlanes ---
		rulerPlane = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(containerWidth, (containerHeight*rulerDivision)), 
			new THREE.MeshBasicMaterial( {color: 0xff0000, transparent: true, opacity: 0} ));
		rulerPlane.overdraw = true;
		rulerPlane.position.set( 0, containerHeight/2-((containerHeight*rulerDivision))/2, -8);
		rulerPlane.planeType = "ruler";
		this.scene.add(rulerPlane);     

		// zoom feedback ---
		zoomPlaneFeedbackLeft = new THREE.Mesh(
			new THREE.PlaneBufferGeometry( containerWidth*0.01, (containerHeight*rulerDivision)), 
			new THREE.MeshBasicMaterial( {color: 0xdd0000, transparent: true, opacity: 0} ));
		zoomPlaneFeedbackLeft.overdraw = true;
		zoomPlaneFeedbackLeft.position.set( srp.x-margin/2, containerHeight/2-((containerHeight*rulerDivision))/2, -5);
		zoomPlaneFeedbackLeft.planeType = "zoomleftfeedback";
		this.scene.add( zoomPlaneFeedbackLeft );

		zoomPlaneFeedbackRight = new THREE.Mesh(
			new THREE.PlaneBufferGeometry( containerWidth*0.01, (containerHeight*rulerDivision)), 
			new THREE.MeshBasicMaterial( {color: 0xdd0000, transparent: true, opacity: 0} ));
		zoomPlaneFeedbackRight.overdraw = true;
		zoomPlaneFeedbackRight.position.set( erp.x+margin/2, containerHeight/2-((containerHeight*rulerDivision))/2, -5);
		zoomPlaneFeedbackRight.planeType = "zoomleftfeedback";
		this.scene.add( zoomPlaneFeedbackRight );

		// highlight line ---
		if( highlightLine !== undefined ) this.scene.remove( highlightLine );

		var hlineMaterial = new THREE.LineBasicMaterial( lineHighlightStyleParams );
		//hlineMaterial.type = THREE.Lines;
		var geometry = new THREE.Geometry();
		geometry.vertices.push( new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0) );
		highlightLine = new THREE.Line( geometry, hlineMaterial );
		highlightLine.currentTime = this.startTime;
		this.scene.add( highlightLine );

		geometry = new THREE.Geometry();
		geometry.vertices.push( new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0) );
		graphHighlightLine = new THREE.Line( geometry, hlineMaterial );
		graphHighlightLine.currentHeight = -1000;
		this.scene.add( graphHighlightLine );

		updateHLine();
		
		this.render();
	};

	// ---
	this.clearTimeline = function()
	{
		// what to clear exactly?
		// removeTemporaryHighlights();
		for( var i = 0, l1 = this.timelineLayers.length, l2 = this.highlightLayers.length;
			i < l1 || i < l2; i++ )
		{
			if( i < l1 )
			{
				this.timelineLayers[i].removeLayer();
				this.timelineLayers[i].timeline = null;
			}
			else if( i < l2 )
			{
				this.highlightLayers[i].removeLayer();
				this.highlightLayers[i].timeline = null;
			}
		}

		this.timelineLayers = [];
		this.highlightLayers = [];

		this.baseAttributeMax = -1;
		this.baseAttributeMin = -1;
		
		mostRecentEventParams = null;
		updateTimeline = true;
		update();
	};
	
	// ---
	this.highlightTimeMoment = function( when, style )
	{
		var highlight = new TJSTIMELINE.Highlight( this, style, when, -1 );
		highlight.drawHighlight();
		this.highlightLayers.push( highlight );

		this.render();
		
		return highlight;		
	};
	
	// ---
	this.highlightTimePeriod = function( startTime, endTime, style )
	{
		//console.log( "htp >>", startTime, endTime, style );

		var highlight = new TJSTIMELINE.Highlight( this, style, startTime, endTime );
		highlight.drawHighlight();
		this.highlightLayers.push( highlight );
		
		this.render();

		return highlight;
	};
	
	// ---
	this.removeHighlight = function( highlight )
	{
		highlight.removeHighlight();
		var found = false;
		for( var i = 0; i < this.highlightLayers.length && !found; i++ )
			if( this.highlightLayers[i].uuid === highlight.uuid )
			{
				found = true;
				this.highlightLayers.splice( i, 1 );
			}
		
		highlight = undefined;

		if( found )
			this.render();

		return found;
	};
	
	// ---
	var updateHLine = function()
	{		
		var xloc = -1000;
		$("#timelinejs_label"+context.uuid).html( context.formatTimestamp( highlightLine.currentTime ) ); 
		if( highlightLine.currentTime === -1 )
		{
			highlightLine.geometry.vertices[0].z = -1000;
			highlightLine.geometry.vertices[1].z = -1000;
			highlightLine.geometry.verticesNeedUpdate = true;

			graphHighlightLine.geometry.vertices[0].z = -1000;
			graphHighlightLine.geometry.vertices[1].z = -1000;
			graphHighlightLine.geometry.verticesNeedUpdate = true;	
			
			if( context.baseAttribute !== null ) graphLabelPlane.position.z = -1000;		
		}
		else
		{
			// it makes no sense why it works with this being here
			// problem: at zoomLevel >= 3, the line is somewhy not visible if only the vertices are updated
			var ct = highlightLine.currentTime;
			context.scene.remove( highlightLine );
			var hlineMaterial = new THREE.LineBasicMaterial( lineHighlightStyleParams );
			//hlineMaterial.type = THREE.Lines;
			var geometry = new THREE.Geometry();
			geometry.vertices.push( new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0) );
			highlightLine = new THREE.Line( geometry, hlineMaterial );
			highlightLine.currentTime = ct;
			context.scene.add( highlightLine );
			// ***********************************

			xloc = context.timestamp2timeline( highlightLine.currentTime );
			highlightLine.geometry.vertices[0] = new THREE.Vector3( xloc, containerHeight/2, -1 );
			highlightLine.geometry.vertices[1] = new THREE.Vector3( xloc,
				(context.baseAttribute === null)? ( (containerHeight/2-(containerHeight*rulerDivision)-2)-(context.timelineLayers.length*context.layerHeight)) : containerHeight/-2, -1);
			highlightLine.geometry.verticesNeedUpdate = true;					


			if( context.baseAttribute !== null )
			{
				// it makes no sense why it works with this being here
				// problem: at zoomLevel >= 3, the line is somewhy not visible if only the vertices are updated
				var ct = graphHighlightLine.currentHeight;
				context.scene.remove( graphHighlightLine );
				var hlineMaterial = new THREE.LineBasicMaterial( lineHighlightStyleParams );
				//hlineMaterial.type = THREE.Lines;
				var geometry = new THREE.Geometry();
				geometry.vertices.push( new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0) );
				graphHighlightLine = new THREE.Line( geometry, hlineMaterial );
				graphHighlightLine.currentHeight = ct;
				context.scene.add( graphHighlightLine );
				// ***********************************

				var yloc = graphHighlightLine.currentHeight; //context.dataValue2TimelineYPos( graphHighlightLine.currentValue );

				graphHighlightLine.geometry.vertices[0] = new THREE.Vector3( anchorPoint.x + (context.width*labelDivision)*0.4, yloc, -1 );
				graphHighlightLine.geometry.vertices[1] = new THREE.Vector3( anchorPoint.x + (context.width), yloc, -1 );
				graphHighlightLine.geometry.verticesNeedUpdate = true;

				graphLabelPlane.position.y = yloc;
				graphLabelPlane.position.z = -1;
				var layerLabel = getTextTexture( context.formatValue( context.timelineYPos2DataValue( graphHighlightLine.currentHeight ) ) );
				graphLabelPlane.material.map = layerLabel;
				graphLabelPlane.material.needsUpdate = true;
			}
		}
		context.render();
	};


	/**
	 * COPIED - ish
	 * Adapted from https://stemkoski.github.io/Three.js/Sprite-Text-Labels.html
	 */
	var getTextTexture = function( message, parameters )
	{
		var w = 512;
		var h = w/2;
		var dynamicTexture = new THREEx.DynamicTexture( w, h );
		dynamicTexture.texture.anisotropy = renderer.getMaxAnisotropy();

		dynamicTexture.context.font	= "bold "+(0.50*w/2)+"px Arial";
		dynamicTexture.clear().drawText(message, undefined, h*2/3, 'black');
		
		return dynamicTexture.texture;

		// naturally bellow this line nothing is used \
		// just keeping it to remember later to add more options onto this function

		var roundRect = function(ctx, x, y, w, h, r) 
		{
		    ctx.beginPath();
		    ctx.moveTo(x+r, y);
		    ctx.lineTo(x+w-r, y);
		    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
		    ctx.lineTo(x+w, y+h-r);
		    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
		    ctx.lineTo(x+r, y+h);
		    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
		    ctx.lineTo(x, y+r);
		    ctx.quadraticCurveTo(x, y, x+r, y);
		    ctx.closePath();
		    ctx.fill();
			ctx.stroke();   
		};

		if ( parameters === undefined ) parameters = {};
		
		var fontface = parameters.hasOwnProperty("fontface") ? 
		parameters["fontface"] : "Arial";
	
		var fontsize = parameters.hasOwnProperty("fontsize") ? 
			parameters["fontsize"] : 30;
		
		var borderThickness = parameters.hasOwnProperty("borderThickness") ? 
			parameters["borderThickness"] : 4;
		
		var borderColor = parameters.hasOwnProperty("borderColor") ?
			parameters["borderColor"] : { r:0, g:0, b:0, a:1.0 };
		
		var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
			parameters["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };		
		
		var canvas = document.createElement('canvas');	
		var context = canvas.getContext('2d');
				
		context.font = "Bold " + fontsize + "px " + fontface;
		
		// get size data (height depends only on font size)
		var metrics = context.measureText( message );		
		var textWidth = metrics.width;		
		canvas.height = Math.ceil(fontsize);		
		canvas.width = Math.ceil( textWidth*1.05 );
		// background color
		context.fillStyle   = "rgba(" + backgroundColor.r + "," + backgroundColor.g + ","+ backgroundColor.b + "," + backgroundColor.a + ")";
		// border color
		context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";
		
		context.lineWidth = 1;
		//roundRect(context, borderThickness/2, borderThickness/2, textWidth*0.5, fontsize*0.85, 0);
		//roundRect(context, 0, 0, textWidth + borderThickness, fontsize * 1.4 + borderThickness, 6);
		// 1.4 is extra height factor for text below baseline: g,j,p,q.
		
		// text color
		context.fillStyle = "rgba(0, 0, 0, 1.0)";
		context.fillText( message, borderThickness, fontsize*0.7 );
		
		// canvas contents will be used for a texture
		var texture = new THREE.Texture( canvas ); 
		texture.needsUpdate = true;
		
		return texture;
		/*
		var materialParams = { 
			map: texture, 
			useScreenCoordinates: false, 
			alignment: spriteAlignment 
		};
		var spriteMaterial = new THREE.SpriteMaterial( materialParams );
		var sprite = new THREE.Sprite( spriteMaterial );
		sprite.scale.set(labelScale.x, labelScale.y , labelScale.z );
		return sprite;*/
	};
	
	// ---
	this.getTimelineVerticalBoundaries = function()
	{
		return [containerHeight/2, (containerHeight/2-(containerHeight*rulerDivision)-2)-(context.timelineLayers.length*context.layerHeight) ];
	};

	// ---
	var onWindowResize = function()
	{
		containerWidth = ("width" in properties)? properties["width"]: (container !== null)? container.clientWidth : null;
		containerHeight = ("height" in properties)? properties["height"]: (container !== null)? container.clientHeight : null;
		context.width = containerWidth;
		context.height = containerHeight;
		renderer.setSize( context.width, context.height );

		context.render();
		
		var div = document.getElementById( "timelinejs_label"+context.uuid );
		div.style.height = rulerDivision*containerHeight+"px";
		div.style.width = labelDivision*containerWidth+"px";
		var pos = WEB_UTILS.findObjectPosition( container );
		
		div.style.left = (pos[0]+1)+"px";
		div.style.top =  (pos[1]+1)+"px";

		updateRulers();
		update();
	};

	var updateRulers = function()
	{
		// to change later
		context.setTimeBoundaries( context.startTime, context.endTime, context.timeStep );
	};

	// ---
	this.render = function()
	{
		//renderer.sortObjects = false;
		renderer.setViewport( 0, 0, containerWidth, containerHeight );
		renderer.clear();

		renderer.setViewport( 
			0, 
			0, 
			labelDivision*containerWidth-1, 
			containerHeight - (containerHeight*rulerDivision)-2 );
		renderer.render( this.scene, labelCamera );

		renderer.setViewport( 
			labelDivision*containerWidth+1, 
			0, 
			containerWidth-(labelDivision*containerWidth), 
			containerHeight -(containerHeight*rulerDivision)-2 );
		renderer.render( this.scene, dataCamera );

		renderer.setViewport( 
			labelDivision*containerWidth+1, 
			containerHeight-((containerHeight*rulerDivision)+2), 
			containerWidth-(labelDivision*containerWidth), 
			(containerHeight*rulerDivision)+2 );     
		renderer.render( this.scene, rulerCamera ); 
	};
	
	// ---
	this.setTimeBoundaries = function( startTime, endTime, timeStep )
	//this.setTimeBoundaries = function( startTime, endTime, temporalUnity )
	{
		this.startTime = startTime;
		this.endTime = endTime;
		this.timeStep = (timeStep !== undefined )? timeStep : this.timeStep;
		//this.temporalUnity = (temporalUnity !== undefined )? temporalUnity : this.temporalUnity;
		// compute changes...
		for( var i = 0, rol = rulerObjects.length; i < rol; i++ )
			//if( !rulerObjects[i].isGraphLine )
			this.scene.remove( rulerObjects[i] );

		var rulerHeight = (containerHeight*rulerDivision)-margin;
		
		//startRulerPoint
		var srp = new THREE.Vector3(  
			anchorPoint.x+(labelDivision*containerWidth)+margin,
			anchorPoint.y-margin-rulerHeight/2, 0 );
		//endRulerPoint
		var erp = new THREE.Vector3( 
			containerWidth/2-margin,
			anchorPoint.y-margin-rulerHeight/2, 0 );

		var lineMaterial = new THREE.LineBasicMaterial( {color: 0x000000, linewidth: 3} );
		var lineMaterial2 = new THREE.LineBasicMaterial( {color: 0xff0000, linewidth: 3} );

		//lineMaterial.type = THREE.Lines;
		var numberSteps = (this.endTime-this.startTime)/this.timeStep;
		
		var geometry = new THREE.Geometry();
		geometry.vertices.push( new THREE.Vector3( srp.x , srp.y+rulerHeight/2, 0 ) );
		geometry.vertices.push( new THREE.Vector3( srp.x, srp.y-rulerHeight/2, 0 ) );		  
		var line = new THREE.Line( geometry, lineMaterial );
		this.scene.add( line );
		rulerObjects.push( line );

		var geometry = new THREE.Geometry();
		geometry.vertices.push( new THREE.Vector3( erp.x , srp.y+rulerHeight/2, 0 ) );
		geometry.vertices.push( new THREE.Vector3( erp.x, srp.y-rulerHeight/2, 0 ) );		  
		var line = new THREE.Line( geometry, lineMaterial );
		this.scene.add( line );
		rulerObjects.push( line );

		if( this.temporalUnity == null ) setDefaultTemporalUnity(); 
		if( this.firstTimeAxis == null ) setDefaultFirstAxis();
		
		for( var ctime = this.firstTimeAxis; ctime < this.endTime; ctime += this.temporalUnity )
		{
			var xloc = this.timestamp2timeline( ctime );
			var geometry = new THREE.Geometry();
			geometry.vertices.push( new THREE.Vector3( xloc , srp.y+rulerHeight/2, 0 ) );
			geometry.vertices.push( new THREE.Vector3( xloc, srp.y-rulerHeight/2, 0 ) );		  
			var line = new THREE.Line( geometry, lineMaterial );
			this.scene.add( line );
			rulerObjects.push( line );	
		}
		
		var geometry = new THREE.Geometry();
		geometry.vertices.push( srp );
		geometry.vertices.push( erp );
		var line = new THREE.Line( geometry, lineMaterial );
		this.scene.add( line );
		rulerObjects.push( line );
		
		// draw ruler 2
		if( this.baseAttribute !== null )
		{
			console.log("dsr-stb");
			var sr2p = new THREE.Vector3(
				anchorPoint.x +(this.width*this.ldiv)*0.45, 
				dataCamera.top*0.9, -1 );
			var er2p = new THREE.Vector3(
				anchorPoint.x +(this.width*this.ldiv)*0.45,
				dataCamera.bottom*0.9, -1 );

			var geometry2 = new THREE.Geometry();
			geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width*this.ldiv)*0.4, sr2p.y, 1 ) );
			geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width), sr2p.y, 1 ) );
			var line2 = new THREE.Line( geometry2, lineMaterial );
			line2.isGraphLine = true;
			context.scene.add( line2 );
			rulerObjects.push( line2 );

			var geometry2 = new THREE.Geometry();
			geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width*this.ldiv)*0.4, er2p.y, 1 ) );
			geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width), er2p.y, 1 ) );
			var line2 = new THREE.Line( geometry2, lineMaterial );
			line2.isGraphLine = true;
			context.scene.add( line2 );
			rulerObjects.push( line2 );

			//numberSteps /= 2;
			//numberSteps = 10;
			var jump = 0.25;
			if ( this.baseAttributeMax > 10 )
				jump = Math.pow( 10, Math.floor(Math.log10( this.baseAttributeMax )) );
			else if( this.baseAttributeMax > 1 )
				jump = 1;

			if( Math.round(this.baseAttributeMax / jump) <= 2 )
				jump /= 10;

			Math.floor(Math.log( this.baseAttributeMax ))
			for( var i = 0; i < this.baseAttributeMax; i +=jump )
			{
				var ypos = this.dataValue2TimelineYPos( i );
				//if( first+i*jump > sr2p.y )
				{
					var geometry2 = new THREE.Geometry();
					geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width*this.ldiv)*0.4, ypos, 1 ) );
					geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width), ypos, 1 ) );
					var line2 = new THREE.Line( geometry2, lineMaterial );
					line2.isGraphLine = true;
					context.scene.add( line2 );
					rulerObjects.push( line2 );
				}
			}
			/*
			for( var i = 0; i <= numberSteps; i++ )
			{		 
				var geometry2 = new THREE.Geometry();
				geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width*this.ldiv)*0.4, (sr2p.y)+(i*(er2p.y-sr2p.y)/numberSteps), 1 ) );
				geometry2.vertices.push( new THREE.Vector3( anchorPoint.x +(this.width), (sr2p.y)+(i*(er2p.y-sr2p.y)/numberSteps), 1 ) );
				var line2 = new THREE.Line( geometry2, lineMaterial );
				line2.isGraphLine = true;
				context.scene.add( line2 );
				rulerObjects.push( line2 );
			}
			*/
			
			var geometry2 = new THREE.Geometry();
			geometry2.vertices.push( sr2p );
			geometry2.vertices.push( er2p );
			var line3 = new THREE.Line( geometry2, lineMaterial );
			line3.isGraphLine = true;
			context.scene.add( line3 );
			rulerObjects.push( line3 );
		}	

		updateHLine();

		this.render();
	};
	// ---
	this.addLayers = function( layers, refresh )
	{
		//console.log("addlay", layers);
		refresh = typeof refresh !== 'undefined' ? refresh : true;
		for( var i = 0, l = layers.length; i < l; i++ )
		{			
			layers[i].setTimeline( this );
			this.timelineLayers.push( layers[i] );

			console.log( "layers yo", this.timelineLayers );

			if( this.baseAttribute !== null )
			{
				for( var i2 = 0, l2 = layers[i].data.length; i2 < l2; i2++ )
				{
					var value = layers[i].data[i2].attributes[this.baseAttribute];
					this.baseAttributeMax = ( this.baseAttributeMax === null || this.baseAttributeMax < value )? value : this.baseAttributeMax;
					this.baseAttributeMin = ( this.baseAttributeMin === null || this.baseAttributeMin > value )? value : this.baseAttributeMin;
				}
				if( this.baseAttributeMin > 0 ) this.baseAttributeMin = 0;

				this.setTimeBoundaries( this.startTime, this.endTime, this.timeStep );
			}
		}

		if( refresh )		
		{
			updateRulers();
			updateTimeline = true;
			update();
		}
	};

	this.getVisibleTime = function()
	{
		var startVisibleTime = this.timeline2timestamp( dataCamera.left );
		var endVisibleTime = this.timeline2timestamp( dataCamera.right );

		return {start: startVisibleTime, end: endVisibleTime };
	};

	// ---
	this.timestamp2timeline = function( timestamp )
	{
		//startRulerPoint
		var rulerHeight = (containerHeight*rulerDivision)-margin;

		var srp = new THREE.Vector3(  
			anchorPoint.x+(labelDivision*containerWidth)+margin,
			anchorPoint.y-margin-rulerHeight/2, 0 );		
		//endRulerPoint
		var erp = new THREE.Vector3( 
			containerWidth/2-margin,
			anchorPoint.y-margin-rulerHeight/2, 0 );

		var timelineTimestamp = WEB_UTILS.scaleDimension(
			[ this.startTime, this.endTime ],
			[ srp.x, erp.x ],
			timestamp
		);
		//console.log( [ this.startTime, this.endTime ], [ srp.x, erp.x ], timestamp, timelineTimestamp );
		return timelineTimestamp;
	};

	// ---
	this.timeline2timestamp = function( timelineLocation )
	{
		//startRulerPoint
		var rulerHeight = (containerHeight*rulerDivision)-margin;
		var srp = new THREE.Vector3(  
			anchorPoint.x+(labelDivision*containerWidth)+margin,
			anchorPoint.y-margin-rulerHeight/2, 0 );
		//endRulerPoint
		var erp = new THREE.Vector3( 
			containerWidth/2-margin,
			anchorPoint.y-margin-rulerHeight/2, 0 );

		var timestamp = WEB_UTILS.scaleDimension(
			[ srp.x, erp.x ],
			[ this.startTime, this.endTime ],			
			timelineLocation
		);

		return timestamp;
	};

	// --- may need to be different from rendering
	this.refresh = function()
	{
		this.render();
	};

	this.layerHeight = 30;
	// ---
	/*
	 *@requires layer.visible
	 */
	this.getLayerYIndex = function( layerName )
	{
		var layerIndex = -1;
		var numNotVisibleLayers = 0;
		for( var i = 0; i < this.timelineLayers.length && layerIndex == -1; i++ )
		{
			if( !this.timelineLayers[i].visible )
				numNotVisibleLayers ++;
			layerIndex = (this.timelineLayers[i].name == layerName)? i : -1;
		}
		layerIndex -= numNotVisibleLayers;			

		return (dataCamera.top - this.layerHeight/2)-(layerIndex * this.layerHeight);
	};

	// ---
	this.dataValue2TimelineYPos = function( value )
	{
		var sr2py = dataCamera.top*0.9;
		var er2py = dataCamera.bottom*0.9;

		var minValue = ( this.baseAttributeMin > 0 )? 0 : this.baseAttributeMin;
		var maxValue = this.baseAttributeMax;

		var newValue = WEB_UTILS.scaleDimension(
			[ minValue+1, maxValue ],
			[ er2py, sr2py ],
			value );

		return newValue;
		//return ( (value * dataCamera.top*0.9) / (this.baseAttributeMax) ) + dataCamera.bottom*0.9;
		
		//return value * (dataCamera.top*0.9-dataCamera.bottom*0.9) / this.baseAttributeMax + (dataCamera.bottom*0.9);
	};

	// ---
	this.timelineYPos2DataValue = function( yPos )
	{
		var sr2py = dataCamera.top*0.9;
		var er2py = dataCamera.bottom*0.9;

		var minValue = ( this.baseAttributeMin > 0 )? 0 : this.baseAttributeMin;
		var maxValue = this.baseAttributeMax;

		var newValue = WEB_UTILS.scaleDimension(
			[ er2py, sr2py ],
			[ minValue+1, maxValue ],
			yPos );

		return newValue;

		//return (yPos- dataCamera.bottom*0.9) * this.baseAttributeMax / (dataCamera.top*0.9); // to verify
	};

	// ---
	this.layerByName = function( layerName )
	{
		var layer2return = null;
		var found = false;
		var i;
		for( i = 0, l = this.timelineLayers.length; i < l && !found; i++ )
		{
			found = this.timelineLayers[i].name === layerName;
			if( found )
				layer2return = this.timelineLayers[i];
		}
		return layer2return;
	};

	// ---
	var update = function()
	{
		if( !updateTimeline ) return;
		for( var i = 0, l = context.timelineLayers.length; i < l; i++ )
		{			
			context.timelineLayers[i].removeLayer();
			context.timelineLayers[i].drawLayer();
		}
		bottomLimit = (topLimit - context.timelineLayers.length*context.layerHeight);
		if( bottomLimit > -containerHeight/2 ) bottomLimit = -containerHeight/2;

		updateTimeline = false;
	};

	// ---
	var printError = function( errorType )
	{
		var errorMessage = "";
		switch( errorType )
		{
			case TJSTIMELINE.ERROR.NO_CONTAINER:
				errorMessage = "Error #"+TJSTIMELINE.ERROR.NO_CONTAINER+": No container was provided";

		}
		console.error( errorMessage );
	};
};

// *******************************
TJSTIMELINE.TimeMoment = function( timestamp, attributes )
{
	this.timestamp = timestamp || 0;
	this.attributes = {};
	if( attributes !== undefined )
	{
		for( var key in attributes )
			this.attributes[key] = attributes[key];
	}

	return this;
};

TJSTIMELINE.TimeMoment.prototype = 
{
	/**
	 * @param timestamp
	 */ 
	setTime: function( timestamp )
	{
		this.timestamp = timestamp;
	},
	
	/**
	 * @param attr
	 */ 
	setAttributes: function( attr )
	{
		if( attr !== undefined )
		{
			for( var key in attr )
				this.attributes[key] = attr[key];
		}
	},

	/**
	 * Determines if two points were detected at the same time
	 * @param otherPoint <STPoint> point to compare
	 * @returns <Bool> true if other point is at the same temporal position as this
	 */ 
	equalsTime: function( otherPoint )
	{
		return this.timestamp === otherPoint.timestamp;
	},

	/**
	 * Determines if a point was detected before or after a certain time
	 * @param timestamp <Integer> unix timestamp to compare
	 * @returns <Integer> 0,1, or -1 depending if this was detected at the same time, after, or before timestamp
	 */ 
	compareTime: function( timestamp )
	{
		if( this.timestamp == timestamp ) return 0;
		else if( this.timestamp < timestamp ) return -1;
		else return 1;
	},

	/**
	 * Creates a copy of this STPoint
	 * @returns <STPoint> a copy of this
	 */ 
	copy: function()
	{
		var timeMoment = new TJSTIMELINE.TimeMoment();		
		timeMoment.setTime( this.timestamp );
		timeMoment.setAttributes( this.attributes );
		
		return timeMoment;
	}
};
// *******************************
TJSTIMELINE.TimePeriod = function( startTimestamp, endTimestamp, attributes )
{
	this.startTimestamp = startTimestamp || 0;
	this.endTimestamp = endTimestamp || 0;
	this.attributes = {};	

	if( attributes !== undefined )
	{
		for( var key in attributes )
			this.attributes[key] = attributes[key];
	}

	return this;
};

TJSTIMELINE.TimePeriod.prototype = 
{
	/**
	 * Creates a copy of this STPoint
	 * @returns <STPoint> a copy of this
	 */ 
	copy: function()
	{
		return new TimePeriod( this.startTimestamp, this.endTimestamp, this.attributes );	
	},

	/**
	 * @param attr
	 */ 
	setAttributes: function( attr )
	{
		if( attr !== undefined )
		{
			for( var key in attr )
				this.attributes[key] = attr[key];
		}
	},

	/**
	 *
	 */
	setTimeBoundaries: function( start, end )
	{
		this.startTimestamp = start;
		this.endTimestamp = end;
	}
};
// *******************************
// create a "point set structure?"

// *******************************
TJSTIMELINE.Highlight = function( timeline, style, startTime, endTime )
{
	this.uuid = WEB_UTILS.generateUUID();
	this.timeline = timeline;
	this.style = style;
	this.startTime = startTime;
	this.endTime = (typeof endTime === 'undefined')? -1 : endTime;
	
	this.highlightObjects = [];
		
	if( endTime === -1 ) // time moment highlight
	{
		var lineMaterial = new THREE.LineBasicMaterial( {linewidth: style.linewidth, color: style.colour, transparent: true, opacity: style.alpha } );
		//lineMaterial.type = THREE.Lines; 
		var geometry = new THREE.Geometry();
		var xloc = this.timeline.timestamp2timeline( startTime );
		var tvb = this.timeline.getTimelineVerticalBoundaries();
		var yloc1 = tvb[0];
		var yloc2 = ( this.timeline.baseAttribute === null )? tvb[1] : - this.timeline.height;
		geometry.vertices.push( new THREE.Vector3(xloc, yloc1, -1) );
		geometry.vertices.push( new THREE.Vector3(xloc, yloc2, -1) );
		
		var line = new THREE.Line( geometry, lineMaterial );
		line.highlight = true;
		this.highlightObjects.push( line );
	}
	else // time period highlight 
	{
		var startColour = style.startColour;
		var endColour = style.endColour;
		var startAlpha = style.startAlpha;
		var endAlpha = style.endAlpha;
		var periodStyle;
		//if( endAlpha !== startAlpha || endColour.getHex() !== startColour.getHex() ) //create texture
		{
			var gTexture = new THREE.Texture( WEB_UTILS.generateGradientTexture( startColour, endColour, startAlpha, endAlpha) );
			gTexture.needsUpdate = true;
			periodStyle = { transparent: true, map: gTexture };
		}
		/*else
		{
			periodStyle = { trasnparent: true, opacity: startAlpha, color: startColour.getHexString() };
		}*/
		var material = new THREE.MeshBasicMaterial( periodStyle );
		
		var tvb = this.timeline.getTimelineVerticalBoundaries();
		var xloc1 = this.timeline.timestamp2timeline( startTime );
		var xloc2 = this.timeline.timestamp2timeline( endTime );
		var planeGeometry = new THREE.PlaneBufferGeometry( Math.abs(tvb[1]-tvb[0]), Math.abs( xloc2 - xloc1 ) );
		
		var plane = new THREE.Mesh( planeGeometry, material );
		plane.geometry.applyMatrix( new THREE.Matrix4().makeRotationZ( - Math.PI / 2 ) ); // rotate the plane
		plane.overdraw = true;
		plane.position.set( (xloc2+xloc1)/2, (tvb[1]+tvb[0])/2, -1 );
		plane.highlight = true;
		
		this.highlightObjects.push( plane );		
	}
	
	// ---
	this.drawHighlight = function()
	{		
		//console.log( "dh", this.highlightObjects );
		for( var i = 0; i < this.highlightObjects.length; i++ )
			this.timeline.scene.add( this.highlightObjects[i] );
	};
	
	// ---
	this.removeHighlight = function()
	{
		for( var i = 0; i < this.highlightObjects.length; i++ )
			this.timeline.scene.remove( this.highlightObjects[i] );
	};
};
// *******************************
TJSTIMELINE.Layer = function( name, data, properties )
{
	var context = this;
	this.name = name;
	this.data = data;	
	this.visible = true;
	this.timeline = null;// = timeline;
	//this.timeline.addLayers( [this] );
	var layerObjects = [];

	var propertiesExist = true;//typeof refresh !== undefined;
	var linkedFeatures = (propertiesExist && properties.hasOwnProperty("linkedFeatures"))?
		properties.linkedFeatures : false;
	// -----
	// --
	var defaultTimePointStyle = function()
	{
		var styleProperties = 
		{
			size: 5,
			colour: new THREE.Color( 0xff0000 ),
			alpha: 1
		};

		return new TJSTIMELINE.Style( styleProperties );
	};
	// --
	var defaultTimePeriodStyle = function()
	{
		var styleProperties = 
		{
			colour: new THREE.Color( 0xaa0000 ),
			alpha: 1,
			size: 5
		};
		return new TJSTIMELINE.Style( styleProperties );
	};

	// --
	var defaultFeatureLinkStyle = function()
	{
		var styleProperties = 
		{
			colour: new THREE.Color( 0x333333 ),
			alpha: 0.5
		};
		return new TJSTIMELINE.Style( styleProperties );
	};

	// --
	var defaultStyleHighlights = function()
	{
		var styleProperties = 
		{
			size: 10,
			colour: new THREE.Color( 0x00ff00 ),
			alpha: 1
		};

		return new TJSTIMELINE.Style( styleProperties );
	};

	// -----
	this.styleTimePoints = (propertiesExist && properties.hasOwnProperty("styleTimePoints"))?
		properties.styleTimePoints : defaultTimePointStyle;
	this.styleTimePeriods = (propertiesExist && properties.hasOwnProperty("styleTimePeriods"))?
		properties.styleTimePeriods : defaultTimePeriodStyle;
	this.styleFeatureLinks = (propertiesExist && properties.hasOwnProperty("styleFeatureLinks") )?
		properties.styleFeatureLinks : defaultFeatureLinkStyle;
	this.styleHighlights = (propertiesExist && properties.hasOwnProperty("styleHighlights"))?
		properties.styleHighlights : defaultStyleHighlights;

	// ---
	this.setTimeline = function( timeline )
	{
		this.timeline = timeline;
	};

	/**
	 * Adapted from https://stemkoski.github.io/Three.js/Sprite-Text-Labels.html
	 */
	var getTextTexture = function( message, parameters )
	{
		var w = 512;
		var h = w/4;
		var dynamicTexture = new THREEx.DynamicTexture( w, h );
		//var dynamicText2d = new THREEx.DynamicText2DObject();
		dynamicTexture.texture.anisotropy = this.timeline.rend.getMaxAnisotropy();

		dynamicTexture.context.font	= "bold "+(0.25*w/2)+"px Arial";
		dynamicTexture.clear().drawText(message, 0.01*w, h*2/3, 'black');
		
		/*dynamicTexture.clear('cyan').drawTextCooked({
			text		: message
		});*/
		
		// dynamicTexture.texture.needsUpdate = true;
		
		return dynamicTexture.texture;

		// naturally bellow this line nothing is used \
		// just keeping it to remember later to add more options onto this function

		var roundRect = function(ctx, x, y, w, h, r) 
		{
		    ctx.beginPath();
		    ctx.moveTo(x+r, y);
		    ctx.lineTo(x+w-r, y);
		    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
		    ctx.lineTo(x+w, y+h-r);
		    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
		    ctx.lineTo(x+r, y+h);
		    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
		    ctx.lineTo(x, y+r);
		    ctx.quadraticCurveTo(x, y, x+r, y);
		    ctx.closePath();
		    ctx.fill();
			ctx.stroke();   
		};

		if ( parameters === undefined ) parameters = {};
		
		var fontface = parameters.hasOwnProperty("fontface") ? 
		parameters["fontface"] : "Arial";
	
		var fontsize = parameters.hasOwnProperty("fontsize") ? 
			parameters["fontsize"] : 21;
		
		var borderThickness = parameters.hasOwnProperty("borderThickness") ? 
			parameters["borderThickness"] : 4;
		
		var borderColor = parameters.hasOwnProperty("borderColor") ?
			parameters["borderColor"] : { r:0, g:0, b:0, a:1.0 };
		
		var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
			parameters["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };		
		
		var canvas = document.createElement('canvas');	
		var context = canvas.getContext('2d');
				
		context.font = "Bold " + fontsize + "px " + fontface;
		
		// get size data (height depends only on font size)
		var metrics = context.measureText( message );		
		var textWidth = metrics.width;		
		canvas.height = Math.ceil(fontsize);		
		canvas.width = Math.ceil( textWidth*1.05 );
		// background color
		context.fillStyle   = "rgba(" + backgroundColor.r + "," + backgroundColor.g + ","+ backgroundColor.b + "," + backgroundColor.a + ")";
		// border color
		context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";
		
		context.lineWidth = 1;
		roundRect(context, borderThickness/2, borderThickness/2, textWidth*0.5, fontsize*0.85, 0);
		//roundRect(context, 0, 0, textWidth + borderThickness, fontsize * 1.4 + borderThickness, 6);
		// 1.4 is extra height factor for text below baseline: g,j,p,q.
		
		// text color
		context.fillStyle = "rgba(0, 0, 0, 1.0)";
		context.fillText( message, borderThickness, fontsize*0.7 );
		
		// canvas contents will be used for a texture
		var texture = new THREE.Texture( canvas ); 
		texture.needsUpdate = true;
		
		return texture;
	};
	// ---
	this.redrawLayer = function()
	{
		var i = layerObjects.length-1;
		console.log( "lobs", layerObjects );
		while( i >= 0 )
		{
			//console.log( "--->", JSON.stringify(i), JSON.stringify(layerObjects.length), layerObjects[i] );

			if( ( layerObjects[i].hasOwnProperty("planeType") && 
				layerObjects[i].planeType != "label" && 
				layerObjects[i].planeType != "timeHelper" ) ||
			 	!layerObjects[i].hasOwnProperty("planeType") )
			{
				this.timeline.scene.remove( layerObjects[i] );
				//layerObjects = 
				layerObjects.splice( i, 1 );
			}
			i --;
		}

		var objects = createTimeFeatures();
		for( var i = 0, l = objects.length; i < l; i++ )
			this.timeline.scene.add( objects[i] );
		this.timeline.refresh();

		layerObjects = layerObjects.concat( objects );
	};

	// ---
	this.drawLayer = function()
	{
		//console.log( "tdata: ", context.data );
		var objects = [];
		if( this.visible )
		{
			if( this.timeline.baseAttribute === null ) // default timeline
			{
				var layerYIndex = context.timeline.getLayerYIndex( context.name );
			
				// create label plane
				var layerLabel = getTextTexture( context.name );
				var labelPlane = new THREE.Mesh(
					new THREE.PlaneBufferGeometry( 
						1,//this.timeline.width*this.timeline.ldiv-2, 
						1), //this.timeline.layerHeight ), 
					new THREE.MeshBasicMaterial( {color: 0xffeeee, map: layerLabel} ) );
				labelPlane.scale.x = this.timeline.width * this.timeline.ldiv*0.5;
				labelPlane.scale.y = this.timeline.layerHeight;
				labelPlane.overdraw = true;
				labelPlane.position.set( -this.timeline.width/2-1 + (labelPlane.scale.x)/2+1, layerYIndex, -1 );
				labelPlane.layer = this.name;
				labelPlane.planeType = "label";
				this.timeline.scene.add(labelPlane); 
				
				// create auxiliar plane
				var auxPlane = new THREE.Mesh(
					new THREE.PlaneBufferGeometry( 
						this.timeline.width - this.timeline.width*this.timeline.ldiv, 
						this.timeline.layerHeight ), 
					new THREE.MeshBasicMaterial( {color: 0xeeeeee} ) );
				auxPlane.overdraw = true;
				auxPlane.position.set( 
					this.timeline.timestamp2timeline( (this.timeline.endTime+this.timeline.startTime)/2 ),  // here
					layerYIndex, -8 );
				auxPlane.layer = this.name;
				auxPlane.planeType = "timeHelper";
				this.timeline.scene.add(auxPlane); 

				objects = objects.concat( labelPlane, auxPlane );
			}
			else // graph like timeline
			{

			}

			// create object representations
			objects = objects.concat( createTimeFeatures() );
			for( var i = 0, l = objects.length; i < l; i++ )
				this.timeline.scene.add( objects[i] );
			this.timeline.refresh();
		}
		layerObjects = objects;
		//console.log( "tlobjs", layerObjects );
	};

	var currentHighlight = 
	{
		feature: null,
		dataPointIndex: null
	};	
	// ---
	this.highlightFeature = function( feature, dataIndex, vertexPoint, vertexPoint2 )
	{
		if( this.styleHighlights === null ) return null;
		var layerYIndex = this.timeline.getLayerYIndex( this.name );
		
		this.removeHighlight();

		var dataPoint = this.data[ dataIndex ];

		if( feature.objtype === TJSTIMELINE.UTILS.OBJECT_TYPES.TIME_POINT_PARTICLE )
		{
			var normalStyle = this.styleTimePoints( this.data, dataPoint, dataIndex );
			var highlightStyle = this.styleHighlights( this.data, dataPoint, dataIndex, normalStyle );
			var geometry = new THREE.BufferGeometry();
			var uniforms = {
				color: { type: "c", value: new THREE.Color( 0xffffff ) },
				tfocus: { type: "i", value: context.timeline.timelineUniforms.tfocus}, 
				tstart: { type: "i", value: context.timeline.timelineUniforms.tstart },
				tend: { type: "i", value: context.timeline.timelineUniforms.tend }
			};
			//var attributes = TJSTIMELINE.UTILS.createAttributesObject();
			var hasTexture = highlightStyle.texture !== undefined && highlightStyle.texture !== null;
			if( hasTexture ) uniforms.texture = { type: "t", value: highlightStyle.texture };					
			
			//var yloc = layerYIndex;
			var yloc;
			if( context.timeline.baseAttribute === null ) yloc = layerYIndex;
			else
			{
				var val = data[dataIndex].attributes[ context.timeline.baseAttribute ];
				yloc = context.timeline.dataValue2TimelineYPos( val );

				confirmation = context.timeline.timelineYPos2DataValue( yloc );
			}

			var xloc = this.timeline.timestamp2timeline( dataPoint.timestamp );
			var vertex = new THREE.Vector3( xloc, yloc, 1 );
			
			var colour2use = ( highlightStyle.colour !== null)? highlightStyle.colour: normalStyle.colour;
			var alphaV = ( highlightStyle.alpha !== null )? highlightStyle.alpha : normalStyle.alpha;
			var sizeV = ((highlightStyle.size !== null)? highlightStyle.size : normalStyle.size );

			var positions = [];
			positions.push( vertex.x, vertex.y, vertex.z );
			var colours = [];
			colours.push( colour2use.r, colour2use.g, colour2use.b );
			var alphas = [];
			alphas.push( alphaV );
			var sizes = [];
			sizes.push( sizeV );
			var times = [];
			times.push( dataPoint.timestamp );

			geometry.addAttribute( 'alpha', new THREE.BufferAttribute( new Float32Array( alphas ), 1 ) );
			geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
			geometry.addAttribute( 'colour', new THREE.BufferAttribute( new Float32Array( colours ), 3 ) );
			geometry.addAttribute( 'size', new THREE.BufferAttribute(  new Float32Array( sizes ), 1 ) );
			//geometry.addAttribute( 'time', new THREE.BufferAttribute(  new Float32Array( times ), 1 ) );
			
			var part = createHParticleSystem( true, true, true, false, hasTexture, uniforms, null, geometry );
			this.timeline.scene.add( part );

			currentHighlight.feature = feature;
			currentHighlight.dpi = dataIndex;
			currentHighlight.style = normalStyle;
			currentHighlight.hstyle = highlightStyle;
			currentHighlight.hobject = part;
			currentHighlight.hobjectIndex = vertexPoint;
			
			feature.geometry.attributes.alpha[vertexPoint] = 0;
			feature.geometry.attributes.alpha.needsUpdate = true;

		}
		else if( feature.objtype === TJSTIMELINE.UTILS.OBJECT_TYPES.POLY_PERIOD )
		{
			console.log( feature );
			var period = this.data[ feature.dpi ];
			var startTimestamp = period.startTimestamp;
			var endTimestamp = period.endTimestamp;
			
			var yloc = layerYIndex;
			var xloc1 = context.timeline.timestamp2timeline( startTimestamp );
			var xloc2 = context.timeline.timestamp2timeline( endTimestamp );

			if( context.timeline.baseAttribute === null )
				var yloc = layerYIndex;	
			else
			{
				var val = data[dataIndex].attributes[ context.timeline.baseAttribute ];
				var yloc = context.timeline.dataValue2TimelineYPos( val );
			}

			var sVertex = new THREE.Vector3( xloc1, yloc, 0 );
			var eVertex = new THREE.Vector3( xloc2, yloc, 0 );

			var nStyle = this.styleTimePeriods( this.data, dataPoint, dataIndex );
			var hlStyle = this.styleHighlights( this.data, dataPoint, dataIndex, nStyle );
			// from stc... how to convert this?
			
			var sWidth = ( hlStyle.startLinewidth !== null)? hlStyle.startLinewidth : 3; //( hStartStyle.lineWidth !== null)? hStartStyle.lineWidth : 1;
			var eWidth = ( hlStyle.endLinewidth !== null)? hlStyle.endLinewidth : 3;
			var faces = 8;		
			var sColour = ( hlStyle.startColour !== null)? hlStyle.startColour : new THREE.Color(0xff0000);
			var eColour = ( hlStyle.endColour !== null)? hlStyle.endColour : new THREE.Color(0xff0000);
			var sAlpha = ( hlStyle.startAlpha !== null)? hlStyle.startAlpha : 1;
			var eAlpha = ( hlStyle.endAlpha !== null)? hlStyle.endAlpha : 1; 
				
			feature.geometry.dispose();

			console.log( "lalalalala~~~~>", startTimestamp, endTimestamp );

			var subline = createPolyLineObject( sVertex, eVertex, sColour, eColour, sAlpha, eAlpha, sWidth, eWidth, startTimestamp, endTimestamp );	

			feature.geometry = subline.geometry;
			
			feature.geometry.attributes.colour.needsUpdate = true;
			feature.geometry.attributes.alpha.needsUpdate = true;
			
			currentHighlight.feature = feature;
			currentHighlight.dpi = dataIndex;
			currentHighlight.style = nStyle;
			currentHighlight.hstyle = hlStyle;								
			currentHighlight.hobject = null;
			currentHighlight.hobjectIndex = null;
		}
		else if( feature.objtype === TJSTIMELINE.UTILS.OBJECT_TYPES.PLANE_PERIOD )
		{				
			// #1 - update texture
			var normalStyle = this.styleTimePeriods( this.data, dataPoint, dataIndex );
			var highlightStyle = this.styleHighlights( this.data, dataPoint, dataIndex, normalStyle );

			var oldTexture = feature.material.map;
			var newTexture = new THREE.Texture( 
				WEB_UTILS.generateGradientTexture( highlightStyle.startColour, highlightStyle.endColour, highlightStyle.startAlpha, highlightStyle.endAlpha ) );
			newTexture.needsUpdate = true;			
			feature.material.map = newTexture;

			// #2 save information of current highlighted data
			currentHighlight.feature = feature;
			currentHighlight.dpi = dataIndex;
			currentHighlight.style = normalStyle;
			currentHighlight.hstyle = highlightStyle;
			currentHighlight.hobject = null;
			currentHighlight.hobjectIndex = null;
			currentHighlight.oldTexture = oldTexture;
		}
		else if( feature.objtype === TJSTIMELINE.UTILS.OBJECT_TYPES.LINE && this.timeline.baseAttribute === null )
		{
			// HERE - vertexPoint2
			console.log("Hey");
			var normalStyle = this.styleFeatureLinks( this.data, this.data[dataIndex], dataIndex, vertexPoint );
			normalStyle.linkStyle = true;
			var highlightStyle = this.styleHighlights( this.data, dataPoint, dataIndex, normalStyle );

			// #1 - add highlight point over line
			var geometry = new THREE.BufferGeometry();
			var uniforms = {
				color: { type: "c", value: new THREE.Color( 0xffffff ) },
				tfocus: { type: "i", value: context.timeline.timelineUniforms.tfocus }, 
				tstart: { type: "i", value: context.timeline.timelineUniforms.tstart },
				tend: { type: "i", value: context.timeline.timelineUniforms.tend }
			};

			var hasTexture = highlightStyle.texture !== undefined && highlightStyle.texture !== null;
			if( hasTexture ) uniforms.texture = { type: "t", value: highlightStyle.texture };

			
			var yloc;
			if( context.timeline.baseAttribute === null ) yloc = layerYIndex;
			else
			{
				var val = data[dataIndex].attributes[ context.timeline.baseAttribute ];
				yloc = context.timeline.dataValue2TimelineYPos( val );
			}

			var xloc = this.timeline.timestamp2timeline( dataPoint.timestamp );
			var vertex = vertexPoint2; //new THREE.Vector3( xloc, yloc, 2 );
			
			var colour2use = ( highlightStyle.colour !== null)? highlightStyle.colour: normalStyle.colour;
			var alphaV = ( highlightStyle.alpha !== null )? highlightStyle.alpha : normalStyle.alpha;
			var sizeV = ((highlightStyle.size !== null)? highlightStyle.size : normalStyle.size );

			var positions = [];
			positions.push( vertex.x, vertex.y, vertex.z );
			var colours = [];
			colours.push( colour2use.r, colour2use.g, colour2use.b );
			var alphas = [];
			alphas.push( alphaV );
			var sizes = [];
			sizes.push( sizeV );
			var times = [];
			times.push( dataPoint.timestamp );

			geometry.addAttribute( 'alpha', new THREE.BufferAttribute( new Float32Array( alphas ), 1 ) );
			geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
			geometry.addAttribute( 'colour', new THREE.BufferAttribute( new Float32Array( colours ), 3 ) );
			geometry.addAttribute( 'size', new THREE.BufferAttribute(  new Float32Array( sizes ), 1 ) );
			//geometry.addAttribute( 'time', new THREE.BufferAttribute(  new Float32Array( times ), 1 ) );
			
			var part = createHParticleSystem( true, true, true, false, hasTexture, uniforms, null, geometry );
			this.timeline.scene.add( part );

			// #2 - save information of current highlighted data
			currentHighlight.feature = feature;
			currentHighlight.dpi = dataIndex;
			currentHighlight.dpi2 = vertexPoint;
			currentHighlight.style = normalStyle;
			currentHighlight.hstyle = highlightStyle;
			currentHighlight.hobject = part;
		}
	};

	// ---
	var createHParticleSystem = function( useSize, useAlpha, useColour, useRotation, useTexture, uniforms, attributes, geometry )
	{
		var shaderStyleSeed = {};
		shaderStyleSeed.size = useSize;
		shaderStyleSeed.alpha = useAlpha;
		shaderStyleSeed.color = useColour;
		shaderStyleSeed.rotation = useRotation;
		if( useTexture ) shaderStyleSeed.texture = useTexture;
	
		var particleMaterial = new THREE.ShaderMaterial( {
			uniforms: uniforms,
			//attributes: attributes,
			vertexShader: TJSTIMELINE.UTILS.generateParticleVertexShader( shaderStyleSeed ),
			fragmentShader: TJSTIMELINE.UTILS.generateParticleFragmentShader( shaderStyleSeed ),							 
			transparent: true,
			side: THREE.DoubleSide				
		});		
		particleMaterial.transparent = true;
		
		// rever esta parte 
		var part = new THREE.Points/*THREE.ParticleSystem*/( geometry, particleMaterial );		
		part.dynamic = true;
		part.sortParticles = true;
		part.layer = context.name;		
		part.objtype = TJSTIMELINE.UTILS.OBJECT_TYPES.H_TIME_POINT_PARTICLE;
		part.name = context.name+"_"+part.objtype;
		part.display = true;		
		
		return part;
	};

	// ---
	this.removeHighlight = function()
	{
		if( currentHighlight.feature === null ) return;

		if( currentHighlight.hobject !== null )
		{
			this.timeline.scene.remove( currentHighlight.hobject );
			currentHighlight.hobject = null;
		}

		if( currentHighlight.feature.objtype === TJSTIMELINE.UTILS.OBJECT_TYPES.TIME_POINT_PARTICLE )
		{
			currentHighlight.feature.geometry.attributes.alpha[ currentHighlight.hobjectIndex  ] = currentHighlight.style.alpha;	
			//this.timeline.onTimelineMouseHoverStop();
		}
		else if( currentHighlight.feature.objtype === TJSTIMELINE.UTILS.OBJECT_TYPES.PLANE_PERIOD )
		{
			currentHighlight.feature.material.map = currentHighlight.oldTexture;
			currentHighlight.feature.material.map.needsUpdate = true;
			//this.timeline.onTimelineMouseHoverStop();
		}
		else if( currentHighlight.feature.objtype === TJSTIMELINE.UTILS.OBJECT_TYPES.POLY_PERIOD )
		{
			console.log( "layer name: ", this.name, this.timeline );
			var layerYIndex = this.timeline.getLayerYIndex( this.name );

			var period = this.data[ currentHighlight.dpi ];
			var startTimestamp = period.startTimestamp;
			var endTimestamp = period.endTimestamp;

			var yloc = layerYIndex;
			var xloc1 = context.timeline.timestamp2timeline( startTimestamp );
			var xloc2 = context.timeline.timestamp2timeline( endTimestamp );

			if( context.timeline.baseAttribute === null )
				var yloc = layerYIndex;	
			else
			{
				var val = data[currentHighlight.dpi].attributes[ context.timeline.baseAttribute ];
				var yloc = context.timeline.dataValue2TimelineYPos( val );
			}

			var sVertex = new THREE.Vector3( xloc1, yloc, 0 );
			var eVertex = new THREE.Vector3( xloc2, yloc, 0 );
			
			var nStyle = currentHighlight.style;//this.styleTimePeriods( this.data, period, currentHighlight.dpi );
			//var nStyle = this.styleLines( this.data, this.data.points[ currentHighlight.dpi ], currentHighlight.dataPointIndex, currentHighlight.dataPointIndex2 );
			console.log( "~~>>", nStyle );
			var sWidth = ( nStyle.startLinewidth !== null)? nStyle.startLinewidth : 2; //( hStartStyle.lineWidth !== null)? hStartStyle.lineWidth : 1;
			var eWidth = ( nStyle.endLinewidth !== null)? nStyle.endLinewidth : 2;
			var faces = 8;		
			var sColour = ( nStyle.startColour !== null)? nStyle.startColour : new THREE.Color(0xff0000);
			var eColour = ( nStyle.endColour !== null)? nStyle.endColour : new THREE.Color(0xff0000);
			var sAlpha = ( nStyle.startAlpha !== null)? nStyle.startAlpha : 1;
			var eAlpha = ( nStyle.endAlpha !== null)? nStyle.endAlpha : 1; 

			var subline = createPolyLineObject( sVertex, eVertex, sColour, eColour, sAlpha, eAlpha, sWidth, eWidth, startTimestamp, endTimestamp );	
			
			currentHighlight.feature.geometry.dispose();
			currentHighlight.feature.geometry = subline.geometry;
			currentHighlight.feature.geometry.attributes.colour.needsUpdate = true;
			currentHighlight.feature.geometry.attributes.alpha.needsUpdate = true;
		}
	};

	// ---
	this.removeLayer = function()
	{
		if( layerObjects === null ) return;
		for( var i = 0, l = layerObjects.length; i < l; i++ )		
			this.timeline.scene.remove( layerObjects[i] );
		this.timeline.refresh();
	};

	// ---
	this.setVisibility = function( visible )
	{
		this.visible = visible;	
		if( !visible )
		{
			this.removeLayer();
		}
		this.timeline.refresh(); // change to redraw - to redraw ruler?
	};

	// ---
	this.switchVisibility = function()
	{
		this.visible = !this.visible;	
		if( !this.visible )
		{
			this.removeLayer();
		}
		this.drawTimeline.refresh(); // change to redraw - to redraw ruler?
	};

	// ---
	this.closestFeatureInTime = function( timestamp )
	{
		//console.log("TODO closestFeatureInTime");
	};

	// ---
	var createTimeFeatures = function()
	{
		if( context.styleTimePoints === null && context.styleTimePeriods === null) return [];
		var featureObjects = [];
		var data = context.data;

		var dataIndex = 0;		
		while( dataIndex < data.length )
		{			
			var feature = data[ dataIndex ];

			if( feature instanceof TJSTIMELINE.TimeMoment )
			{
				var timeMomentReps = createParticlePoints( data, dataIndex );								
				featureObjects = featureObjects.concat( timeMomentReps.objs );
				dataIndex = timeMomentReps.dpi;
			}
			else if( feature instanceof TJSTIMELINE.TimePeriod )
			{				
				var timePeriods = createPolyPeriods( data, dataIndex ); //createPlanePeriods( data, dataIndex );
				featureObjects = featureObjects.concat( timePeriods.objs );				
				dataIndex = timePeriods.dpi;
			}
			else
			{
				dataIndex ++;
			}
		}
		dataIndex = 0;
		while( linkedFeatures && dataIndex < data.length )
		{			
			var timeLinks = createLinkLines( data, dataIndex );
			featureObjects = featureObjects.concat( timeLinks.objs );
			dataIndex = timeLinks.dpi;
		}
		//console.log( featureObjects );
		return featureObjects;		
	};

	// ---
	var createParticlePoints = function( data, dataIndex )
	{
		//console.log( "ppgen", data );
		var layerYIndex = context.timeline.getLayerYIndex( context.name );
		var createParticleSystem = function( useSize, useAlpha, useColour, useRotation, useTexture, uniforms, geometry, fdpi )
		{
			var shaderStyleSeed = 
			{
				size: useSize,
				alpha: useAlpha,
				color: useColour,
				rotation: useRotation
			};		
			if( useTexture ) shaderStyleSeed.texture = useTexture;
		
			var particleMaterial = new THREE.ShaderMaterial( {
				uniforms: uniforms,
				vertexShader: TJSTIMELINE.UTILS.generateParticleVertexShader( shaderStyleSeed ),
				fragmentShader: TJSTIMELINE.UTILS.generateParticleFragmentShader( shaderStyleSeed ),							 
				transparent: true,
				side: THREE.DoubleSide				
			});		
			//particleMaterial.transparent = true;
			
			var part = new THREE.Points( geometry, particleMaterial );		
			part.dynamic = true;
			part.sortParticles = true;
			part.layer = context.name;			
			part.objtype = TJSTIMELINE.UTILS.OBJECT_TYPES.TIME_POINT_PARTICLE;//"trajpoints";
			part.name = context.data.name+"_"+part.objtype;						
			part.fdpi = fdpi;
			part.display = true;
			
			return part;
		};

		var addAttributes2Geometry = function( geometry, sizes, positions, colours, alphas, times )
		{
			geometry.addAttribute( 'size',  new THREE.BufferAttribute( new Float32Array( sizes ), 1 ) );
			geometry.addAttribute( 'position',  new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
			geometry.addAttribute( 'colour',  new THREE.BufferAttribute( new Float32Array( colours ), 3 ) );
			geometry.addAttribute( 'alpha',  new THREE.BufferAttribute( new Float32Array( alphas ), 1 ) );
			geometry.addAttribute( 'time',  new THREE.BufferAttribute( new Float32Array( times ), 1 ) );

			return geometry;
		};

		var featureStyle = context.styleTimePoints( data, data[dataIndex], dataIndex );
		var particleObjects = [];

		// we need to create as many particle systems as different textures are used - feelsbadman
		var geometry, uniforms, attributes, hasTexture, fdpi; // first data point index
		var createNew = true;
		var lastTexture = null;

		var positions, sizes, colours, alphas, times; // arrays with attribute info
		
		while( featureStyle !== null && (data[dataIndex] instanceof TJSTIMELINE.TimeMoment) && dataIndex < data.length )
		{
			featureStyle = context.styleTimePoints( data, data[dataIndex], dataIndex );

			if( featureStyle !== null )
			{
				if( featureStyle.texture !== undefined && featureStyle.texture !== null )
				{
					if( lastTexture !== null && featureStyle.texture.sourceFile !== lastTexture.sourceFile )
					{
						geometry = addAttributes2Geometry( geometry, sizes, positions, colours, alphas, times );
						var part = createParticleSystem( true, true, true, true, hasTexture, uniforms, geometry, fdpi );
						createNew = true;
						particleObjects.push( part );
					}
					hasTexture = true;
					lastTexture = featureStyle.texture;
				}
			}
			else
				createNew = true;

			if( featureStyle !== null && createNew )
			{
				geometry = new THREE.BufferGeometry();
				uniforms = {
					color: { type: "c", value: new THREE.Color( 0xffffff ) },
					tfocus: context.timeline.timelineUniforms.tfocus, 
					tstart: context.timeline.timelineUniforms.tstart,
					tend: context.timeline.timelineUniforms.tend
				};
				if( hasTexture )
					uniforms.texture = { type: "t", value: featureStyle.texture };

				positions = [];
				colours = [];
				alphas = [];
				sizes = [];
				times = [];
				fdpi = dataIndex;
				createNew = false;
			}

			if( featureStyle !== null )
			{
				var feature = data[ dataIndex ];
				var xloc = context.timeline.timestamp2timeline( feature.timestamp );
				var yloc;
				if( context.timeline.baseAttribute === null ) yloc = layerYIndex;
				else
				{
					var val = data[dataIndex].attributes[ context.timeline.baseAttribute ];
					yloc = context.timeline.dataValue2TimelineYPos( val );
				}

				positions.push( xloc, yloc, 1 );
				var c = ( featureStyle.colour != null)? featureStyle.colour: new THREE.Color(0xff0000);
				colours.push( c.r, c.g, c.b );
				var a = ( featureStyle.alpha != null )? featureStyle.alpha : 1.0;
				alphas.push( a );
				var s = ( featureStyle.size != null )? featureStyle.size : 3;
				sizes.push( s );
				times.push( feature.timestamp );
			}
				
			dataIndex ++;
		}
		
		geometry = addAttributes2Geometry( geometry, sizes, positions, colours, alphas, times );
		var part = createParticleSystem( true, true, true, true, hasTexture, uniforms, geometry, fdpi );		
		particleObjects.push( part );
		
		if( featureStyle == null )
			dataIndex ++;
		console.log( "pobjs ", particleObjects );
		return { objs: particleObjects, dpi: dataIndex };
	};

	var setFaceRGBA3 = function( colourHolder, alphaHolder, baseIndex, colour, alpha )
	{
		colourHolder[ baseIndex + 0 ] = colour.r;
		colourHolder[ baseIndex + 1 ] = colour.g;
		colourHolder[ baseIndex + 2 ] = colour.b;

		for( var i = 0; i < 3; i++ )
			alphaHolder[ baseIndex + i ] = alpha;
	};

	var setFaceRGBA9 = function( colourHolder, alphaHolder, baseIndex, colour, alpha )
	{
		colourHolder[ baseIndex + 0 ] = colour.r;
		colourHolder[ baseIndex + 1 ] = colour.g;
		colourHolder[ baseIndex + 2 ] = colour.b;
		colourHolder[ baseIndex + 3 ] = colour.r;
		colourHolder[ baseIndex + 4 ] = colour.g;
		colourHolder[ baseIndex + 5 ] = colour.b;
		colourHolder[ baseIndex + 6 ] = colour.r;
		colourHolder[ baseIndex + 7 ] = colour.g;
		colourHolder[ baseIndex + 8 ] = colour.b;

		for( var i = 0; i < 9; i++ )
			alphaHolder[ baseIndex + i ] = alpha;
	};

	var setFaceRGBAT3 = function( timeHolder, colourHolder, alphaHolder, baseIndex, time, colour, alpha )
	{
		colourHolder[ baseIndex + 0 ] = colour.r;
		colourHolder[ baseIndex + 1 ] = colour.g;
		colourHolder[ baseIndex + 2 ] = colour.b;

		for( var i = 0; i < 3; i++ ){
			alphaHolder[ baseIndex + i ] = alpha;
			timeHolder[baseIndex + i ] = time;
		}
	};

	var setFaceRGBAT9 = function( timeHolder, colourHolder, alphaHolder, baseIndex, time, colour, alpha )
	{
		colourHolder[ baseIndex + 0 ] = colour.r;
		colourHolder[ baseIndex + 1 ] = colour.g;
		colourHolder[ baseIndex + 2 ] = colour.b;
		colourHolder[ baseIndex + 3 ] = colour.r;
		colourHolder[ baseIndex + 4 ] = colour.g;
		colourHolder[ baseIndex + 5 ] = colour.b;
		colourHolder[ baseIndex + 6 ] = colour.r;
		colourHolder[ baseIndex + 7 ] = colour.g;
		colourHolder[ baseIndex + 8 ] = colour.b;

		for( var i = 0; i < 9; i++ ){
			alphaHolder[ baseIndex + i ] = alpha;
			timeHolder[baseIndex + i ] = time;
		}
	};

	var createPolyLineObject = function( sVertex, eVertex, sColour, eColour, sAlpha, eAlpha, sWidth, eWidth, sTime, eTime ){
		var uniforms = {
			color:     { type: "c", value: new THREE.Color( 0xffffff ) }, // somewhy.... this works like this - go figure....
			tfocus:  /*{ type: "i", value:*/ context.timeline.timelineUniforms.tfocus,
			tstart: /*{ type: "i", value: */context.timeline.timelineUniforms.tstart,
			tend: /*{ type: "i", value: */context.timeline.timelineUniforms.tend 
		};
		var geo = new THREE.CylinderGeometry( sWidth, eWidth, 1, 8 );
		geo.applyMatrix( new THREE.Matrix4().makeRotationX( Math.PI / -2 ) );
		
		var positions 	= new Float32Array( geo.faces.length * 3 * 3 );
		var colours 	= new Float32Array( geo.faces.length * 3 * 3 );
		var alphas 		= new Float32Array(  geo.faces.length * 3 * 3 );
		var times 		= new Float32Array(  geo.faces.length * 3 * 3 );
		
		for( var i = 0; i < geo.faces.length; i++ )
		{	
			positions[ i * 9 + 0 ] = geo.vertices[ geo.faces[i].a ].x;
			positions[ i * 9 + 1 ] = geo.vertices[ geo.faces[i].a ].y;
			positions[ i * 9 + 2 ] = geo.vertices[ geo.faces[i].a ].z;
			positions[ i * 9 + 3 ] = geo.vertices[ geo.faces[i].b ].x;
			positions[ i * 9 + 4 ] = geo.vertices[ geo.faces[i].b ].y;
			positions[ i * 9 + 5 ] = geo.vertices[ geo.faces[i].b ].z;
			positions[ i * 9 + 6 ] = geo.vertices[ geo.faces[i].c ].x;
			positions[ i * 9 + 7 ] = geo.vertices[ geo.faces[i].c ].y;
			positions[ i * 9 + 8 ] = geo.vertices[ geo.faces[i].c ].z;		

			if( i >= geo.faces.length/2 )
			{
				if( i >= geo.faces.length/2 + geo.faces.length/4 )
					setFaceRGBAT9( times, colours, alphas, i*9, eTime, eColour, eAlpha );	
				else
					setFaceRGBAT9( times, colours, alphas, i*9, sTime, sColour, sAlpha );
			}
			else if( i % 2 == 0 ) 
			{
				setFaceRGBAT3( times, colours, alphas, i*9, sTime, sColour, sAlpha );
				setFaceRGBAT3( times, colours, alphas, i*9+3, eTime, eColour, eAlpha );
				setFaceRGBAT3( times, colours, alphas, i*9+6, sTime, sColour, sAlpha );
			}
			else
			{
				setFaceRGBAT3( times, colours, alphas, i*9, eTime, eColour, eAlpha );
				setFaceRGBAT3( times, colours, alphas, i*9+3, eTime, eColour, eAlpha );
				setFaceRGBAT3( times, colours, alphas, i*9+6, sTime, sColour, sAlpha );
			}
		}

		var geometry = new THREE.BufferGeometry().fromGeometry(geo);
		geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
		geometry.addAttribute( 'colour', new THREE.BufferAttribute( colours, 3 ) );
		geometry.addAttribute( 'alpha', new THREE.BufferAttribute( alphas, 3 ) );
		geometry.addAttribute( 'time', new THREE.BufferAttribute( times, 3 ) );
		geometry.removeAttribute( 'color' );

		var shaderStyleSeed = {};
		shaderStyleSeed.alpha = true;
		shaderStyleSeed.color = true;
				
		var material = new THREE.ShaderMaterial( {
			uniforms: uniforms,
			vertexShader: TJSTIMELINE.UTILS.generateLineVertexShader( shaderStyleSeed ),
			fragmentShader: TJSTIMELINE.UTILS.generateLineFragmentShader( shaderStyleSeed ),
			transparent: true
		});		
					
		var subline = new THREE.Mesh( geometry, material );
		subline.castShadow = true;
		subline.position.x = sVertex.x;
		subline.position.y = sVertex.y;
		subline.position.z = sVertex.z;
		subline.lookAt( eVertex );

		var dist = sVertex.distanceTo( eVertex );
		subline.scale.set( 1, 1, dist );
		subline.translateZ( 0.5*dist );
		subline.overdraw = true;

		return subline;
	};

	var createPolyPeriods = function( data, dataIndex )
	{
		var periodRepresentationObjects = [];
		var layerYIndex = context.timeline.getLayerYIndex( context.name );
		var featureStyle = context.styleTimePeriods( data, data[dataIndex], dataIndex );	

		while( featureStyle !== null && data[dataIndex] instanceof TJSTIMELINE.TimePeriod && dataIndex < data.length )
		{
			var uniforms = {};

			var feature = data[dataIndex];
			var startTimestamp = feature.startTimestamp;
			var endTimestamp = feature.endTimestamp;
			
			var yloc = layerYIndex;
			var xloc1 = context.timeline.timestamp2timeline( startTimestamp );
				//context.timeline.timestamp2timeline( (endTimestamp+startTimestamp)/2 );
			var xloc2 = context.timeline.timestamp2timeline( endTimestamp );
			//var xsize = Math.abs(context.timeline.timestamp2timeline(endTimestamp)-
			//			context.timeline.timestamp2timeline(startTimestamp));

			if( context.timeline.baseAttribute === null )
				var yloc = layerYIndex;	
			else
			{
				var val = data[dataIndex].attributes[ context.timeline.baseAttribute ];
				var yloc = context.timeline.dataValue2TimelineYPos( val );
			}

			//featureStyle = context.styleTimePeriods( data, data[dataIndex], dataIndex );

			if( featureStyle !== null )
			{
				var sVertex = new THREE.Vector3( xloc1, yloc, 0 );
				var eVertex = new THREE.Vector3( xloc2, yloc, 0 );

				var sWidth = ( featureStyle.startLineWidth != null)? featureStyle.startLineWidth : 5;
				var eWidth = ( featureStyle.endLineWidth != null)? featureStyle.endLineWidth : 5;
				var faces = 8;
				var sColour = (featureStyle.startColour !== null )? featureStyle.startColour : new THREE.Color(0xff0000);
				var eColour = (featureStyle.endColour !== null )? featureStyle.endColour : new THREE.Color(0x00ff00);
				var sAlpha = (featureStyle.startAlpha !== null )? featureStyle.startAlpha : 1;
				var eAlpha = (featureStyle.endAlpha !== null )? featureStyle.endAlpha : 0.5;

				var periodRep = createPolyLineObject( sVertex, eVertex, sColour, eColour, sAlpha, eAlpha, sWidth, eWidth, startTimestamp, endTimestamp );

				periodRep.layer = context.name;
				periodRep.objtype = TJSTIMELINE.UTILS.OBJECT_TYPES.POLY_PERIOD;
				periodRep.name = context.name+"_"+periodRep.objtype;
				periodRep.dpi = dataIndex;
				periodRep.display = true;

				periodRepresentationObjects.push( periodRep );
			}

			dataIndex ++;
			if( dataIndex < data.length )
				featureStyle = context.styleTimePeriods( data, data[dataIndex], dataIndex );
		}

		if( featureStyle === null )
			dataIndex ++;

		return { objs: periodRepresentationObjects, dpi: dataIndex };
	};

	// ---
	var createPlanePeriods = function( data, dataIndex )
	{
		var layerYIndex = context.timeline.getLayerYIndex( context.name );
		var planeObjects = [];
		var featureStyle = context.styleTimePeriods( data, data[dataIndex], dataIndex );

		//console.log( "~~~~~~~>", dataIndex );

		while( featureStyle !== null && data[dataIndex] instanceof TJSTIMELINE.TimePeriod && dataIndex < data.length )
		{
			var uniforms = {};
			var attributes = {
				alpha: {type: "f", value: [] },
				colour: {type:"c", value: [] }
			};

			var feature = data[dataIndex];
			var startTimestamp = feature.startTimestamp;
			var endTimestamp = feature.endTimestamp;
			
			var yloc = layerYIndex;
			var xloc = 
				context.timeline.timestamp2timeline( (endTimestamp+startTimestamp)/2 );
			var xsize = Math.abs(context.timeline.timestamp2timeline(endTimestamp)-
						context.timeline.timestamp2timeline(startTimestamp));

			if( context.timeline.baseAttribute === null )
				var yloc = layerYIndex;	
			else
			{
				var val = data[dataIndex].attributes[ context.timeline.baseAttribute ];
				var yloc = context.timeline.dataValue2TimelineYPos( val );
			}

			var startColour = (featureStyle.startColour !== null )? featureStyle.startColour :
				new THREE.Color(0xff0000);
			var endColour = (featureStyle.endColour !== null )? featureStyle.endColour :
				new THREE.Color(0x00ff00);
			var startAlpha = (featureStyle.startAlpha !== null )? featureStyle.startAlpha :
				1;
			var endAlpha = (featureStyle.endAlpha !== null )? featureStyle.endAlpha :
				0.5;

			//console.log( "adasd>", xloc, xsize, context.timeline.layerHeight-5);
			// the cube needs to be rotated
			var geometry = new THREE.PlaneBufferGeometry( context.timeline.layerHeight-5, xsize);
			var gTexture = new THREE.Texture( 
				WEB_UTILS.generateGradientTexture(startColour, endColour, startAlpha, endAlpha) );
			gTexture.needsUpdate = true;
			var planeStyle = { transparent: true, map: gTexture };			

			var material = new THREE.MeshBasicMaterial( planeStyle );

			var plane = new THREE.Mesh( geometry, material );
			plane.geometry.applyMatrix( new THREE.Matrix4().makeRotationZ( - Math.PI / 2 ) ); // rotate the plane
			plane.overdraw = true;
			plane.position.set( xloc, yloc, 0 );
			plane.layer = context.name;
			plane.objtype = TJSTIMELINE.UTILS.OBJECT_TYPES.PLANE_PERIOD;
			plane.name = context.name+"_"+plane.objtype;
			plane.dpi = dataIndex;
			plane.display = true;

			planeObjects.push( plane );

			dataIndex ++;
			if( dataIndex < data.length )
				featureStyle = context.styleTimePeriods( data, data[dataIndex], dataIndex );
		}

		if( featureStyle === null )
			dataIndex ++;

		return { objs: planeObjects, dpi: dataIndex };
	};

	var insertVertexInfo = function( vertex, style, dpi, dataPointIndexes, positions, colours, alphas, lDistances, lTotalSizes, lDashSizes, preVertex, hadDashed, startS )
	{	
		dataPointIndexes.push( dpi );
		positions.push( vertex.x, vertex.y, vertex.z );
		var c, a;
		if( startS )
		{
			c = (style.startColour !== null)? style.startColour : new THREE.Color(0xff0000);
			a = (style.startAlpha !== null)? style.startAlpha : 1;		
		}
		else
		{
			c = (style.startColour !== null)? style.endColour : new THREE.Color(0xff0000);
			a = (style.startAlpha !== null)? style.endAlpha : 1;			
		}

		colours.push( c.r, c.g, c.b );
		alphas.push( a );
		var distance = (preVertex !== null)? vertex.distanceTo( preVertex ) : 0;

		if( style.dashedLine )
		{
			hadDashed = true;				
			var gapSize = ( "gapSize" in style && style.gapSize !== null )? style.gapSize: 1;
			var dashSize = ("dashSize" in style && style.dashSize !== null )? style.dashSize: 1;
			lTotalSizes.push( dashSize+gapSize );
			lDashSizes.push( dashSize );
		}
		else if( hadDashed )
		{
			lTotalSizes.push( distance );
			lDashSizes.push( distance );
		}

		if( preVertex !== null ) lDistances.push( distance );

		return hadDashed;
	};

	// ---
	var createLinkLines = function( data, di )
	{
		var dataIndex = di;
		var layerYIndex = context.timeline.getLayerYIndex( context.name );

		var lineObjects = [];
		var uniforms = {
			color:     { type: "c", value: new THREE.Color( 0xffffff ) },
			tfocus: context.timeline.timelineUniforms.tfocus,
			tstart: context.timeline.timelineUniforms.tstart,
			tend: context.timeline.timelineUniforms.tend
		};

		var attributes = {};
		/*	alpha: { type: "f", value: [] },
			colour: { type: "c", value: [] },
			lineDistance: { type: "f", value: [] },
			totalSize: { type: "f", value: [] },
			dashSize: { type: "f", value: [] }
		};*/						
		var hadDashed = false;
		var hasLineWidth = false;
		var mostRecentLineWidth = 1;

		var geometry = new THREE.BufferGeometry();
		var featureStyle = context.styleFeatureLinks( data, data[dataIndex], dataIndex, dataIndex+1 );
		var lastStyle = featureStyle;
		var attributeIndex = 0;

		var positions = [];
		var sizes = [];
		var alphas = [];
		var colours = [];
		var dataPointIndexes = [];
		var lDistances = [];
		var lDashSizes = [];
		var lTotalSizes = [];
		var times = [];

		var preVertex = null;

		while( (dataIndex < data.length) && featureStyle !== null  )
		{
			if( data[dataIndex] instanceof TJSTIMELINE.TimePeriod )
			{
				featureStyle = context.styleFeatureLinks( data, data[dataIndex], dataIndex, dataIndex );

				var xloc1 = context.timeline.timestamp2timeline( data[dataIndex].startTimestamp );
				var xloc2 = context.timeline.timestamp2timeline( data[dataIndex].endTimestamp );

				if( context.timeline.baseAttribute === null )
					var yloc = layerYIndex;	
				else
				{
					var val = data[dataIndex].attributes[ context.timeline.baseAttribute ];
					var yloc = context.timeline.dataValue2TimelineYPos( val );
				}

				// HERE
				var vertex1 = new THREE.Vector3( xloc1, yloc, 0 );
				//vertex1.dpi = dataIndex;
				//geometry.vertices.push( vertex1 );
				//hadDashed = 
				insertVertexInfo( vertex1, featureStyle, dataIndex, dataPointIndexes, positions, colours, alphas, lDistances, lTotalSizes, lDashSizes, preVertex, hadDashed, true );
				times.push( data[dataIndex].startTimestamp );
				preVertex = vertex1;

				var vertex2 = new THREE.Vector3( xloc2, yloc, 0 );
				insertVertexInfo( vertex2, featureStyle, dataIndex, dataPointIndexes, positions, colours, alphas, lDistances, lTotalSizes, lDashSizes, preVertex, hadDashed, false );
				preVertex = vertex2;
				times.push( data[dataIndex].endTimestamp );
				//vertex2.dpi = dataIndex;
				//geometry.vertices.push( vertex2 );

				/*attributes.colour.value.push( (featureStyle.startColour !== null)? 
					featureStyle.startColour : new THREE.Color(0xff0000) );				
				attributes.colour.value.push( (featureStyle.endColour !== null)? 
					featureStyle.endColour : new THREE.Color(0x00ff00) );

				attributes.alpha.value.push( (featureStyle.startAlpha !== null)? 
					featureStyle.startAlpha : 1 );
				attributes.alpha.value.push( (featureStyle.endAlpha !== null)? 
					featureStyle.endAlpha : 1 );
				*/
			}
			else if( data[dataIndex] instanceof TJSTIMELINE.TimeMoment && dataIndex < data.length-1 )
			{
				// needs compensation
				var needsCompensation = 
					(attributeIndex == 0 || 
						(featureStyle.startAlpha !== lastStyle.endAlpha || featureStyle.startColour.getHex() !== lastStyle.endColour.getHex()));
				
				var startTimestamp, endTimestamp;

				if( needsCompensation )
				{
					startTimestamp = data[dataIndex].timestamp;

					var xloc1 = context.timeline.timestamp2timeline( startTimestamp );

					if( context.timeline.baseAttribute === null )
						var yloc = layerYIndex;	
					else
					{
						var val = data[dataIndex].attributes[ context.timeline.baseAttribute ];
						var yloc = context.timeline.dataValue2TimelineYPos( val );
					}
					
					var vertex1 = new THREE.Vector3( xloc1, yloc, 0 );
					hadDashed = insertVertexInfo( vertex1, featureStyle, dataIndex, dataPointIndexes, positions, colours, alphas, lDistances, lTotalSizes, lDashSizes, preVertex, hadDashed, true );
					times.push( startTimestamp );
					preVertex = vertex1;
				}

				endTimestamp = data[dataIndex+1].timestamp;				
				var xloc2 = context.timeline.timestamp2timeline( endTimestamp );	

				if( context.timeline.baseAttribute === null )
					var yloc = layerYIndex;	
				else
				{
					var val = data[dataIndex+1].attributes[ context.timeline.baseAttribute ];
					var yloc = context.timeline.dataValue2TimelineYPos( val );
				}
				
				var vertex2 = new THREE.Vector3( xloc2, yloc, 0 );
						
				hadDashed = insertVertexInfo( vertex2, featureStyle, dataIndex, dataPointIndexes, positions, colours, alphas, lDistances, lTotalSizes, lDashSizes, preVertex, hadDashed, false );
				preVertex = vertex2;
				times.push( endTimestamp );
			}

			lastStyle = featureStyle;			
			dataIndex ++;
			attributeIndex+=2; // not fully sure on this yet

			if( dataIndex < data.length-1 )
				featureStyle = context.styleFeatureLinks( data, data[dataIndex], dataIndex, dataIndex+1 );
			if( featureStyle instanceof TJSTIMELINE.TimeMoment )
				dataIndex ++;
		}

		if( featureStyle === null )
			dataIndex ++;

		if( positions.length > 0 )
		{
			var shaderStyleSeed = {};
			shaderStyleSeed.alpha = true;
			shaderStyleSeed.color = true;
			
			if( hadDashed )
			{
				lDistances.push(0); // because it needs to <_<
				geometry.addAttribute( 'totalSize',  new THREE.BufferAttribute( new Float32Array( lTotalSizes ), 1 ) );
				geometry.addAttribute( 'dashSize',  new THREE.BufferAttribute( new Float32Array( lDashSizes ), 1 ) );
				geometry.addAttribute( 'lineDistance',  new THREE.BufferAttribute( new Float32Array( lDistances ), 1 ) );	
			}

			geometry.addAttribute( 'position',  new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
			geometry.addAttribute( 'colour',  new THREE.BufferAttribute( new Float32Array( colours ), 3 ) );
			geometry.addAttribute( 'alpha',  new THREE.BufferAttribute( new Float32Array( alphas ), 1 ) );
			geometry.addAttribute( 'dpi',  new THREE.BufferAttribute( new Float32Array( dataPointIndexes ), 1 ) );
			geometry.addAttribute( 'time',  new THREE.BufferAttribute( new Float32Array( times ), 1 ) );


			var linesMaterial = new THREE.ShaderMaterial( {
				uniforms: uniforms,
				//attributes: attributes,
				vertexShader: TJSTIMELINE.UTILS.generateLineVertexShader( shaderStyleSeed ),
				fragmentShader: TJSTIMELINE.UTILS.generateLineFragmentShader( shaderStyleSeed ),			
				transparent: true			
			});
												
			linesMaterial.linewidth = 3;		
			
			var line = new THREE.Line( geometry, linesMaterial );
			line.layer = context.name;
			line.objtype = TJSTIMELINE.UTILS.OBJECT_TYPES.LINE;
			line.name = context.data.name+"_"+line.objtype;		
			line.display = true;
			//line.datauuid = data.uuid;
			line.verticesNeedUpdate = true;
			lineObjects.push(line);
		}				
		//console.log( "clf", dataIndex );
		return { objs: lineObjects, dpi: dataIndex };
	};	
};
// *******************************
TJSTIMELINE.Style = function( params )
{
	var paramConstrainted = function( params, item )
	{
		return params !== undefined && params.hasOwnProperty( item );
	};

	this.size 		= ( paramConstrainted( params, "size") )? params.size : 1;
	this.width 		= ( paramConstrainted( params, "width") )? params.width : this.size;
	this.height 	= ( paramConstrainted( params, "height") )? params.height : this.size;	
	this.rotation 	= ( paramConstrainted( params, "rotation") )? params.rotation : null;

	this.x 			= ( paramConstrainted( params, "x") )? params.x : params.width;
	this.y  		= ( paramConstrainted( params, "y") )? params.y : params.height;
	
	this.alpha 		= ( paramConstrainted( params, "alpha") )? params.alpha : 1;
	this.startAlpha = ( paramConstrainted( params, "startAlpha") )? params.startAlpha : this.alpha;
	this.endAlpha 	= ( paramConstrainted( params, "endAlpha") )? params.endAlpha : this.alpha; 

	this.colour 	 = ( paramConstrainted( params, "colour") )? params.colour : null;
	this.startColour = ( paramConstrainted( params, "startColour") )? params.startColour : this.colour;
	this.endColour 	 = ( paramConstrainted( params, "endColour") )? params.endColour : this.colour; 

	this.texture 	 = ( paramConstrainted( params, "texture") )? params.texture : null;	
	
	this.linewidth 	 	= ( paramConstrainted( params, "linewidth") )? params.linewidth : this.width;
	this.startLinewidth	= ( paramConstrainted( params, "startLinewidth") )? params.startLinewidth : this.linewidth;
	this.endLinewidth	= ( paramConstrainted( params, "endLinewidth") )? params.endLinewidth : this.linewidth;

	// lazy I know
	this.startLineWidth	= ( paramConstrainted( params, "startLinewidth") )? params.startLinewidth : this.linewidth;
	this.endLineWidth	= ( paramConstrainted( params, "endLinewidth") )? params.endLinewidth : this.linewidth;

	//this.dashedLine = ( params !== undefined && "dashed" in params)? params.dashed : false;
	//this.lineDistance = ( params !== undefined && "lineDistance" in params)? params.lineDistance : null;
	//this.totalSize = ( params !== undefined && "totalSize" in params)? params.totalSize : null;
	//this.dashSize = ( params !== undefined && "dashSize" in params)? params.dashSize : null;
	//this.gapSize = ( params !== undefined && "gapSize" in params)? params.gapSize : null;
};

TJSTIMELINE.Style.prototype = 
{
	setSize: function( size1, size2 )
	{
		var size2Exists = typeof refresh !== 'undefined';
		if( !size2Exists )
			this.size = this.width = this.height = this.x = this.y = size1;
		else
		{
			this.size = 1;
			this.width = this.x = size1;
			this.height = this.y = size2;
		}
	},

	setColour: function( colour1, colour2 )
	{
		var c2e = typeof colour2 !== 'undefined';
		if( !c2e )
			this.colour = this.startColour = this.endColour = colour1;
		else
		{
			this.colour = null;
			this.startColour = colour1;
			this.endColour = colour2;
		}
	},

	setAlpha: function( alpha1, alpha2 )
	{
		var a2e = typeof refresh !== 'undefined';
		if( !a2e )
			this.alpha = this.startAlpha = this.endAlpha = alpha1;
		else
		{
			this.alpha = null;
			this.startAlpha = alpha1;
			this.endAlpha = alpha2;
		}
	},

	setRGB: function( r, g, b )
	{
		this.colour = this.endColour = this.startColour = new THREE.Colour( r, g, b );
	},
	
	setRGBA: function( r, g, b, a )
	{
		this.colour = new THREE.Colour( r, g, b );
		this.alpha = this.startAlpha = this.endAlpha = a;
	},

	setTexture: function( texture )
	{
		this.texture = texture;
	},

	setLinewidth: function( width1, width2 )
	{
		var l2e = typeof refresh !== 'undefined';
		if( !l2e )
			this.linewidth = this.startLinewidth = this.endLinewidth = width1;
		else
		{
			this.linewidth = null;
			this.startLinewidth = width1;
			this.endLinewidth = width2;
		}
	}
};
// *******************************
/**
 *
 */
TJSTIMELINE.ERROR = 
{
	NO_CONTAINER: 1
};
// *******************************
/**
 * 
 */ 
TJSTIMELINE.UTILS = function(){};
/**
 * 
 */
TJSTIMELINE.UTILS.OBJECT_TYPES = 
{
	TIME_POINT_PARTICLE: "tmjspart_tpoint",
	H_TIME_POINT_PARTICLE: "tmjspart_tpoint_h",
	PLANE_PERIOD: "tmjsplane_tperiod",
	POLY_PERIOD: "tmjspoly_tperiod",
	LINE: "tmjsline_featurelink",
	NONE: "none"
};
TJSTIMELINE.UTILS.TIME_FLAGS = 
{
	ONE_HOUR: 3600, // (sec)
	ONE_DAY: 86400, // (sec)
	ONE_WEEK: 604800, // 7 days
	ONE_MONTH: 2592000, // 30 days
	NONE: -1
};
/**
 * 
 */
TJSTIMELINE.UTILS.ZONE_TYPES = 
{
	RULER: "tmjsz_ruler",
	DATA: "tmjsz_data",
	LABEL: "tmjsz_label"
};
/**
 * 
 */ 
TJSTIMELINE.UTILS.createAttributesObject = function()
{
	var attributes = {};
	attributes.size = {};
	attributes.alpha = {};
	attributes.colour = {};
	attributes.rotation = {};
	
	attributes.size.type = "f";
	attributes.alpha.type = "f";
	attributes.colour.type = "c";
	attributes.rotation.type = "f";
	
	attributes.size.value = [];
	attributes.alpha.value = [];
	attributes.colour.value = [];
	attributes.rotation.value = [];
	
	return attributes;
};

/**
* Generates glsl code for the vertex shader to be used for the definition of particle points
* @param attr - key: <bool>value array with the the types of attributes in need to be used 
* @returns <String> glsl code
*/  
TJSTIMELINE.UTILS.generateParticleVertexShader = function( attr )
{
	var vertexShaderText = "";//"//auto generated vertex shader\n";

	vertexShaderText += "uniform int tfocus;\n\n";
	vertexShaderText += "uniform int tstart;\n\n";
	vertexShaderText += "uniform int tend;\n\n";
	if( "size" in attr ) vertexShaderText += "attribute float size;\n";
	if( "alpha" in attr ) vertexShaderText += "attribute float alpha;\n";
	if( "color" in attr ) vertexShaderText += "attribute vec3 colour;\n";		
	if( "rotation" in attr ) vertexShaderText += "attribute float rotation;\n";
	vertexShaderText += "attribute float time;\n";

	if( "alpha" in attr ) vertexShaderText += "varying float vAlpha;\n";
	if( "color" in attr ) vertexShaderText += "varying vec3 vColor;\n";		
	if( "rotation" in attr ) vertexShaderText += "varying float vRotation;\n";
	vertexShaderText += "varying float vTime;\n";

	vertexShaderText += "void main()\n{\n  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n  gl_Position = projectionMatrix * mvPosition;\n  ";
	if( "size" in attr ) vertexShaderText += "gl_PointSize = size;\n  ";
	else vertexShaderText += "gl_PointSize = 3;\n  ";
	if( "alpha" in attr ) vertexShaderText += "vAlpha = alpha;\n  ";
	else vertexShaderText += "vAlpha = 1;\n  ";
	if( "color" in attr ) vertexShaderText += "vColor = colour;\n";
	else vertexShaderText += "vColor = vec3(0,0,0);\n";
	if( "rotation" in attr ) vertexShaderText += "  vRotation = rotation;\n"
	vertexShaderText += "  vTime = time;\n"
	vertexShaderText += "	if( tfocus == 1 && (int(vTime) <= tstart || int(vTime) >= tend) ) gl_PointSize = 0.0;\n"
	vertexShaderText += "}\n";		 
	return vertexShaderText;
};

/**
* Generates glsl code for the fragment shader to be used for the definition of particle points
* @param attr - key: <bool>value array with the the types of attributes in need to be used 
* @returns <String> glsl code
*/ 
TJSTIMELINE.UTILS.generateParticleFragmentShader = function( attr )
{
	var fragmentShaderText = "";//"//auto generated fragment shader\n";
	fragmentShaderText += "uniform int tfocus;\n\n";
	fragmentShaderText += "uniform int tstart;\n\n";
	fragmentShaderText += "uniform int tend;\n\n";
	fragmentShaderText += "uniform vec3 color;\n";
	 if( "texture" in attr ) fragmentShaderText += "uniform sampler2D texture;\n\n";
	 if( "alpha" in attr ) fragmentShaderText += "varying float vAlpha;\n";
	 if( "color" in attr ) fragmentShaderText += "varying vec3 vColor;\n";
	 if( "rotation" in attr ) fragmentShaderText += "varying float vRotation;\n";
	 fragmentShaderText += "varying float vTime;\n";
	 
	 fragmentShaderText += "void main()\n{\n  ";
	 var alphaText = ("alpha" in attr)? "vAlpha" : "1.0" ;		 
	 fragmentShaderText += "float trueAlpha = "+alphaText+";\n";
	 
	 fragmentShaderText += "if( tfocus == 1 )\n";
	 fragmentShaderText += "  if( int(vTime) >= tstart && int(vTime) <= tend ) trueAlpha = trueAlpha;\n"
	 fragmentShaderText += "  else trueAlpha = 0.0;\n"

	 if( "color" in attr ) fragmentShaderText += "gl_FragColor = vec4( vColor * color, trueAlpha );\n";
	 else fragmentShaderText += "gl_FragColor = vec4( 0.0, 0.0, 0.0, trueAlpha );\n";
	 
	 if( "texture" in attr ) 
		if( "rotation" in attr )
		{
			fragmentShaderText += "  float mid = 0.5;\n";
			fragmentShaderText += "  vec2 rotated = vec2(cos(vRotation) * (gl_PointCoord.x - mid) + sin(vRotation) * (gl_PointCoord.y - mid) + mid, cos(vRotation) * (gl_PointCoord.y - mid) - sin(vRotation) * (gl_PointCoord.x - mid) + mid);\n";
			fragmentShaderText += "  gl_FragColor = gl_FragColor * texture2D( texture, rotated );\n";
		}
		else
			fragmentShaderText += "  gl_FragColor = gl_FragColor * texture2D( texture, gl_PointCoord );\n";
	 
	 fragmentShaderText += "}\n";
		 
	 return fragmentShaderText;
};

/**
* Generates glsl code for the vertex shader to be used for the definition of lines
* @param attr - key: <bool>value array with the the types of attributes in need to be used 
* @returns <String> glsl code
*/ 
TJSTIMELINE.UTILS.generateLineVertexShader = function( attr )
{
	var vertexShaderText = "";//"//auto generated vertex shader\n";		 
	
	if( "alpha" in attr ) vertexShaderText += "attribute float alpha;\n";
	if( "color" in attr ) vertexShaderText += "attribute vec3 colour;\n";
	if( "dashed" in attr ) vertexShaderText += "attribute float lineDistance;\nattribute float dashSize;\nattribute float totalSize;\n"+
	"varying float vLineDistance;\nvarying float vDashSize;\nvarying float vTotalSize;\n";
	vertexShaderText += "attribute float time;\n"
	vertexShaderText += "varying vec2 vUv;\n";
		 
	if( "alpha" in attr ) vertexShaderText += "varying float vAlpha;\n  ";
	if( "color" in attr ) vertexShaderText += "varying vec3 vColor;\n  ";		 
	vertexShaderText += "varying float vTime;\n";

	vertexShaderText += "void main()\n{\n  gl_Position = projectionMatrix * ( modelViewMatrix * vec4(position, 1.0) );\n  ";		 		 
	vertexShaderText += "  vUv = uv;\n"

	if( "dashed" in attr ) vertexShaderText += "vLineDistance = 1.0*lineDistance;\n  vDashSize = dashSize;\n  vTotalSize = totalSize;\n  "; // scale*lineDistance
	if( "alpha" in attr ) vertexShaderText += "vAlpha = alpha;\n  ";
	else vertexShaderText += "vAlpha = 1.0;\n  ";
	if( "color" in attr ) vertexShaderText += "vColor = colour;\n";
	else vertexShaderText += "vColor = vec3(0,0,0);\n";		 
	vertexShaderText += "  vTime = time;\n"
	vertexShaderText += "}\n";
			 
	return vertexShaderText;
};

/**
* Generates glsl code for the fragment shader to be used for the definition of lines
* @param attr - key: <bool>value array with the the types of attributes in need to be used 
* @returns <String> glsl code
*/ 
TJSTIMELINE.UTILS.generateLineFragmentShader = function( attr )
{
	var fragmentShaderText = "";//"//auto generated fragment shader\n";	
	fragmentShaderText += "uniform int tfocus;\n\n";
	fragmentShaderText += "uniform int tstart;\n\n";
	fragmentShaderText += "uniform int tend;\n\n";
	fragmentShaderText += "uniform vec3 color;\n";
	if( "texture" in attr ) fragmentShaderText += "uniform sampler2D texture;\n\n";
	if( "alpha" in attr ) fragmentShaderText += "varying float vAlpha;\n";
	if( "color" in attr ) fragmentShaderText += "varying vec3 vColor;\n";
	if( "dashed" in attr ) fragmentShaderText += "varying float vLineDistance;\nvarying float vDashSize;\nvarying float vTotalSize;\n  ";
	fragmentShaderText += "varying float vTime;\n";
	fragmentShaderText += "varying vec2 vUv;\n";

	fragmentShaderText += "void main()\n{\n  ";
	var alphaText = ("alpha" in attr)? "vAlpha" : "1" ;
	fragmentShaderText += "float trueAlpha = "+alphaText+";\n";

	fragmentShaderText += "if( tfocus == 1 )\n";
	fragmentShaderText += "  if( int(vTime) >= tstart && int(vTime) <= tend ) trueAlpha = trueAlpha;\n"
	fragmentShaderText += "  else trueAlpha = 0.0;\n"

	if( "dashed" in attr ) fragmentShaderText += "if( mod( vLineDistance, vTotalSize ) > vDashSize ) { discard; }\n  ";

	if( "color" in attr ) fragmentShaderText += "gl_FragColor = vec4( color * vColor, trueAlpha );\n";
	else fragmentShaderText += "  gl_FragColor = vec4( 0.0, 0.0, 0.0, trueAlpha );\n";		 

	if( "texture" in attr ){
		fragmentShaderText += "  gl_FragColor = gl_FragColor * texture2D( texture, vUv );\n";
	}

	fragmentShaderText += "}\n";

	return fragmentShaderText;
};