/**
 * Object that represents a trajectory
 * @param name <String> name of the trajectory
 */ 
function Trajectory( name )
{
	this.uuid = UTILS.generateUUID();
	this.name = (name !== undefined)? name : "trajectory_"+this.uuid;
	this.points = [];
	this.attributes = {};
	this.bBox = null;
	this.timeSpan = null;
	
	return this;
}

Trajectory.prototype = 
{
	/**
	 * @param name
	 */ 
	setName: function( name )
	{
		this.name = name;
	},
	/**
	 * Adds points to the trajectory
	 * @param stpoints <Array:<STPoint>> 
	 */ 
	appendPoints: function( stpoints )
	{
		for( var i = 0; i < stpoints.length; i++ )
			this.points.push( stpoints[i].copy() );
			
		this.computeBoundingBox();
		this.computeTimePeriod();
	},
	
	/**
	 * Adds attributes/semantic information to the trajectory
	 * @param attr key:value array with the attributes
	 */ 
	addAttributes: function( attr )
	{
		if( attr !== undefined )
		{
			for( var key in attr )
				this.attributes[key] = attr[key];
		}
	},
	
	/**
	 * Returns the bounding box containing this trajectory
	 * @returns key:value array with the values of the coordinates for up, down, left, and right
	 */ 
	boundingBox: function()
	{
		if( this.bBox !== null )
			return this.bBox;
		else
			return computeBoundingBox();
	},
	
	/**
	 * Calculates the bounding box containing this trajectory
	 * @returns key:value array with the values of the coordinates for up, down, left, and right
	 */ 
	computeBoundingBox: function()
	{
		var box = {};
		box.up = -180;
		box.down = 180;
		box.left = 180;
		box.right = -180;
		for( var i = 0; i < this.points.length; i++ )
		{
			var point = this.points[i];
			
			box.up = (point.latitude > box.up)? point.latitude : box.up;
			box.down = (point.latitude < box.down)? point.latitude : box.down;
			box.left = (point.longitude < box.left)? point.longitude : box.left;
			box.right = (point.longitude > box.right)? point.longitude : box.right;
		}
		bBox = box;
		return box;
	},
	
	/**
	 * Returns the time period when this trajectory was detected
	 * @returns key:value array with the start and end time values of this trajectory
	 */ 
	timePeriod: function()
	{
		if( this.timeSpan !== null )
			return this.timeSpan;
		else
			return computeTimePeriod();
	},
	
	/**
	 * Calculates the time period when this trajectory was detected
	 * @returns key:value array with the start and end time values of this trajectory 
	 */ 
	computeTimePeriod: function()
	{
		var timeP = [];
		if( this.points.length == 1 )
			timeP = {start: this.points[0].timestamp, end: this.points[0].timestamp};
		else if( this.points.length > 1 )
			timeP = {start: this.points[0].timestamp, end: this.points[this.points.length-1].timestamp};
		this.timeSpan = timeP;
		return timeP;
	},
	
	/**
	 * Calculates the bounding box and the time period of this trajectory
	 */
	commitChanges: function()
	{
		this.computeBoundingBox();
		this.computeTimePeriod();
	}, 
	
	/**
	 * Converts this trajectory to GeoJSON format
	 * @returns <String> this in GeoJSON format
	 */ 
	toGeoJSON: function()
	{
		var geoJSONOutput = {};
		geoJSONOutput.type = "FeatureCollection";
		geoJSONOutput.properties = {};
		for( var att in this.attributes )
			geoJSONOutput.properties[att] = this.attributes[att];			
		var features = new Array();
		var pointFeature;
		for( var i = 0; i < this.points.length; i++ )
		{
			var point = this.points[i];
			pointFeature = new Array();
			pointFeature.type = "Feature";
			pointFeature.properties = {};
			for( var p in point.attributes )
				pointFeature.properties[p] = attributes[p];	
			pointFeatures.properties.uuid = this.uuid;
			pointFeature.geometry = {};
			pointFeature.geometry.type = "Point";
			pointFeature.geometry.coordinates = [point.longitude, point.latitude, point.altitude];
			features.push(pointFeature);
		}
		geoJSONOutput.features = features;
		
		return geoJSONOutput;
	},
	
	/**
	 * Returns information of the closest point in time to time
	 * @param time <Integer> timestamp
	 * @returns object containing information baout the point and index of closest point
	 */ 
	closestInTime: function( time )
	{
		var tp = this.timePeriod();
		var result; 
		
		if( time <= tp.start )
			result = { point: this.points[0], index: 0};
		else if( time >= tp.end ) 
			result = { point: this.points[this.points.length-1], index: this.points.length-1 };
		else
		{
			var deltaTime = (tp.end - tp.start);
			var deltaSearch = (time - tp.start);
			 
			var si = Math.floor( (deltaSearch/deltaTime) * (this.points.length));
			var limit = ( this.points[si].timestamp < time )? this.points.length : 0;		 
			var factor = ( this.points[si].timestamp < time )? 1 : -1;
						
			var i = si;
			for( ; i != limit && 
				( ( factor > 0 && this.points[i].timestamp < time ) 
				|| ( factor < 0 && this.points[i].timestamp > time) ); i+= factor ){}			
			if( factor > 0 )
				i --;
			 
			result = {};
			result.point = this.points[i];
			result.index = i;
		} 		  
		return result;
	},
	
	/**
	 * Creates a copy of this trajectory
	 * @returns <Trajectory> a copy of this
	 */ 
	copy: function()
	{
		var newTraj = new Trajectory();
		newTraj.uuid = this.uuid;
		newTraj.name = this.name;
		
		newTraj.appendPoints( this.points );
		newTraj.addAttributes( this.attributes );
				
		return newTraj;
	}
};

/** **************************************************************** **/

/**
 * Object representing a set of spatio-temporal points
 * @param name - name of this point set
 */
function STPointSet( name )
{
	this.uuid = UTILS.generateUUID();
	this.name = name;
	this.points = [];
	this.attributes = {};
	this.bbox = null;
	this.timeSpan = null;
}

STPointSet.prototype = 
{
	/**
	 * Adds points to the set
	 * @param stpoints <Array:<STPoint>> 
	 */  
	appendPoints: function( stpoints )
	{
		for( var i = 0; i < stpoints.length; i++ )		
			this.points.push( stpoints[i].copy() );
		this.timeSpan = null;
		this.bbox = null;
	},
	
	/**
	 * Adds attributes/semantic information to the set
	 * @param attr key:value array with the attributes
	 */ 
	addAttributes: function( attr )
	{
		if( attr !== undefined )
		{
			for( var key in attr )
				this.attributes[key] = attr[key];
		}
	},
	
	/**
	 * Calculates the bounding box containing this trajectory
	 * @returns key:value array with the values of the coordinates for up, down, left, and right
	 */ 
	boundingBox: function()
	{
		if( this.bbox !== null ) return this.bbox;
		else
		{
			var box = {};
			box.up = -180;
			box.down = 180;
			box.left = 180;
			box.right = -180;
			for( var i = 0; i < this.points.length; i++ )
			{
				var point = this.points[i];
				
				box.up = (point.latitude > box.up)? point.latitude : box.up;
				box.down = (point.latitude < box.down)? point.latitude : box.down;
				box.left = (point.longitude < box.left)? point.longitude : box.left;
				box.right = (point.longitude > box.right)? point.longitude : box.right;
			}
			this.bbox = box;
			return box;
		}
	},
	
	/**
	 * Returns the time period when this trajectory was detected
	 * @returns key:value array with the start and end time values of this trajectory
	 */
	timePeriod: function()
	{
		if( this.timeSpan !== null ) return this.timeSpan;
		else
		{
			var box = {};
			box.start = (new Date()).getTime()/1000;
			box.end = -1;			
			for( var i = 0; i < this.points.length; i++ )
			{
				var point = this.points[i];				
				box.start = (point.timestamp < box.start)? point.timestamp : box.start;
				box.end = (point.timestamp > box.end)? point.timestamp : box.end;				
			}
			this.timeSpan = box;			
			return box;
		}
	}
};


/** **************************************************************** **/

/**
 * Object representing a set of spatio-temporal points
 * @param name - name of this point set
 */
function STPeriodSet( name )
{
	this.uuid = UTILS.generateUUID();
	this.name = name;
	this.periods = [];
	this.attributes = {};
	this.bbox = null;
	this.timeSpan = null;
}

STPeriodSet.prototype = 
{
	/**
	 * Adds points to the set
	 * @param stpoints <Array:<STPoint>> 
	 */  
	appendPoints: function( stpoints )
	{
		for( var point in stpoints )
			this.points.push( point.copy() );
		this.timeSpan = null;
		this.bbox = null;
	},
	
	/**
	 * Adds attributes/semantic information to the set
	 * @param attr key:value array with the attributes
	 */ 
	addAttributes: function( attr )
	{
		if( attr !== undefined )
		{
			for( var key in attr )
				this.attributes[key] = attr[key];
		}
	},
	
	/**
	 * Calculates the bounding box containing this trajectory
	 * @returns key:value array with the values of the coordinates for up, down, left, and right
	 */ 
	boundingBox: function()
	{
		if( this.bbox !== null ) return this.bbox;
		else
		{
			var box = {};
			box.up = -180;
			box.down = 180;
			box.left = 180;
			box.right = -180;
			for( var i = 0; i < this.periods.length; i++ )
			{
				var point = this.periods[i];
				
				box.up = (point.latitude > box.up)? point.latitude : box.up;
				box.down = (point.latitude < box.down)? point.latitude : box.down;
				box.left = (point.longitude < box.left)? point.longitude : box.left;
				box.right = (point.longitude > box.right)? point.longitude : box.right;
			}
			this.bbox = box;
			return box;
		}
	},
	
	/**
	 * Returns the time period when this trajectory was detected
	 * @returns key:value array with the start and end time values of this trajectory
	 */
	timePeriod: function()
	{
		if( this.timeSpan !== null ) return this.timeSpan;
		else
		{
			var box = {};
			box.start = (new Date()).getTime();
			box.end = -1;			
			for( var i = 0; i < this.periods.length; i++ )
			{
				var point = this.periods[i];
				
				box.start = (point.timestamp_start < box.start)? point.timestamp_start : box.start;
				box.end = (point.timestamp_end > box.end)? point.timestamp_end : box.end;				
			}
			this.timeSpan = box;
			return box;
		}
	} 
};

/** **************************************************************** **/

/**
 * Object that represents a space-time point
 * @param lat <Float> latitude
 * @param lon <Float> longitude
 * @param alt <Float> altitude
 * @param time <Integer> unix timestamp
 * @param attr <Object> attributes
 */ 
function STPoint( lat, lon, alt, time, attr )
{
	this.latitude = Number(lat) || 0;
	this.longitude = Number(lon) || 0;
	this.altitude = Number(alt) || 0;
	this.timestamp = time || -1; // unix timestamp
	this.attributes = {};
	if( attr !== undefined )
	{
		for( var key in attr )
			this.attributes[key] = attr[key];
	}	
	
	return this;
}

STPoint.prototype = 
{	
	/**
	 * @param lat
	 * @param lon
	 * @param alt
	 */ 
	setCoordinates: function( lat, lon, alt )
	{
		this.latitude = lat || 0;
		this.longitude = lon || 0;
		this.altitude = alt || 0;
	},
	
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
	 * Determines if two points are at the same position
	 * @param otherPoint <STPoint> point to compare
	 * @returns <Bool> true if other point is at the same position as this
	 */ 
	equalsPosition: function( otherPoint )
	{
		return this.latitude === otherPoint.latitude && 
			this.longitude === otherPoint.longitude &&
			this.altitude === otherPoint.altitude;
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
		var newPoint = new STPoint();
		newPoint.setCoordinates( this.latitude, this.longitude, this.altitude );
		newPoint.setTime( this.timestamp );
		newPoint.setAttributes( this.attributes );
		
		return newPoint;
	},
	
	/**
	 * Calculates the distance of this point to a certain location
	 * @param lat1 <Float> latitude
	 * @param lon1 <Float> longitude
	 * @param unit <String> "K" or "N" for Kms or.... something I can't remember
	 */ 
	distanceTo: function( lat1, lon1, unit )
	{
		var radlat1 = Math.PI * lat1/180
		var radlat2 = Math.PI * this.latitude/180
		var radlon1 = Math.PI * lon1/180
		var radlon2 = Math.PI * this.longitude/180
		var theta = lon1-this.longitude
		var radtheta = Math.PI * theta/180
		var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
		dist = Math.acos(dist)
		dist = dist * 180/Math.PI
		dist = dist * 60 * 1.1515
		if (unit=="K") { dist = dist * 1.609344 }
		if (unit=="N") { dist = dist * 0.8684 }
		return dist
	},
	
	/**
	 * 
	 */ 
	toString: function()
	{
		var tostringmsg = "[("+this.latitude+", "+this.longitude+", "+this.altitude+"), "+(new Date(this.timestamp*1000))+", [ ";
		for( var attr in this.attributes )
			tostringmsg += " "+attr+": "+this.attributes[attr]+","
		tostringmsg = tostringmsg.substring( 0, tostringmsg.length-1);
		tostringmsg += " ] ]";
		
		return tostringmsg;
	}
};
/** **************************************************************** **/
/**
 * 
 */
function STPeriod( lat, lon, alt, start, end, attr )
{
	this.latitude = lat || 0;
	this.longitude = lon || 0;
	this.altitude = alt || 0;
	this.timestamp_start = start || -1; // unix timestamp
	this.timestamp_end = end || -1; // unix timestamp
	this.attributes = {};
	if( attr !== undefined )
	{
		for( var key in attr )
			this.attributes[key] = attr[key];
	}	
	
	return this;
}

STPeriod.prototype = 
{
	toSTPoint: function()
	{
		var stpoint = new STPoint( this.latitude, this.longitude, this.altitude, this.timestamp_start, this.attributes );
		stpoint.setAttributes( {timestamp_end: this.timestamp_end} );
		return stpoint;
	},
	
	fromSTPoint: function( point )
	{
		this.latitude = point.latitude;
		this.longitude = point.longitude;
		this.altitude = point.altitude;
		this.setAttributes( point.attributes );
		this.timestamp_start = point.timestamp;
		this.timestamp_end = point.attributes.timestamp_end || this.timestamp_start;
	},
	
	/**
	 * @param lat
	 * @param lon
	 * @param alt
	 */ 
	setCoordinates: function( lat, lon, alt )
	{
		this.latitude = lat || 0;
		this.longitude = lon || 0;
		this.altitude = alt || 0;
	},
	
	/**
	 * @param timestamp
	 */ 
	setTime: function( timestamp_start, timestamp_end )
	{
		this.timestamp_start = timestamp_start || this.timestamp_start;
		this.timestamp_end = timestamp_end || this.timestamp_end;
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
	 * Determines if two points are at the same position
	 * @param otherPoint <STPoint> point to compare
	 * @returns <Bool> true if other point is at the same position as this
	 */ 
	equalsPosition: function( otherPoint )
	{
		return this.latitude === otherPoint.latitude && 
			this.longitude === otherPoint.longitude &&
			this.altitude === otherPoint.altitude;
	},
	
	/**
	 * Creates a copy of this STPoint
	 * @returns <STPoint> a copy of this
	 */ 
	copy: function()
	{
		var newPeriod = new STPeriod();
		newPoint.setCoordinates( this.latitude, this.longitude, this.altitude );
		newPoint.setTime( this.timestamp_start, this.timestamp_end );
		newPoint.setAttributes( this.attributes );
		
		return newPoint;
	},
	
};

/** **************************************************************** **/

/**
 * Utility functions
 */ 
function UTILS()
{
	this.VERSION = "1";
}

/**
 * Generates a uuid...
 * @returns <String> random uuid
 */ 
UTILS.generateUUID = function()
{
	var charset = "abcdefghijklmnopqrstuvwxyz0123456789";
	return 	UTILS.generateRandomString(8, charset)+"-"+
			UTILS.generateRandomString(4, charset)+"-"+
			UTILS.generateRandomString(4, charset)+"-"+
			UTILS.generateRandomString(4, charset)+"-"+
			UTILS.generateRandomString(12, charset);	
};
	
/**
 * Generates a random string
 * @param size <Integer> size of the string to be generated
 * @param charset <Array:<String>> string with the characters that can be used to generate the string
 * @returns <String> random string
 */
UTILS.generateRandomString = function(size, charset)
{
	var randomString = "";
	for( var i = 0; i < size; i ++ )
		randomString += charset.charAt(Math.floor(Math.random()*charset.length));
	return randomString;
};

/**
 * 
 */
UTILS.generateGradientTexture = function( startColour, endColour, startAlpha, endAlpha ) {
	var size = 512;
	// create canvas
	canvas = document.createElement( 'canvas' );
	canvas.width = size;
	canvas.height = size;

	// get context
	var context = canvas.getContext( '2d' );
	
	//context.translate(canvas.width / 2, canvas.height / 2);
	//context.rotate( Math.PI/2 );

	// draw gradient
	context.rect( 0, 0, size, size );
	
	var gradient = context.createLinearGradient( size, size, size, 0 );
	gradient.addColorStop(0, 'rgba('+255*startColour.r+','+255*startColour.g+','+255*startColour.b+','+startAlpha+');'); 
	gradient.addColorStop(1, 'rgba('+255*endColour.r+','+255*endColour.g+','+255*endColour.b+','+endAlpha+');');
		
	context.fillStyle = gradient;
	context.fill();
	
	return canvas;
};
	
/**
 * Converts one value from one scale to the other
 * (note: this 'behaves' as linear scale transformation)
 * @param domain <Array> array with two values representing the min and max values the input value can hold
 * @param range <Array> array with two values representing the min and max values the transformed input value can be
 * @param input <Number> value bellonging to domain to be converted into one bellonging to range
 * @returns <Number> converted input
 */ 
UTILS.scaleDimension = function( domain, range, input )
{
	var output = (input-domain[0])/(domain[1]-domain[0]);
	output = (range[1]-range[0])*output + range[0];
	return output;		
};
	
/**
 * Returns the screen location of an html object 
 * @param obj - object to locate
 * @return an array with two positions with the left and top positions of the object
 */ 
UTILS.findObjectPosition = function(obj) 
{
	var curleft = curtop = 0;
	if (obj.offsetParent) 
	{
		do
		{
			curleft += obj.offsetLeft;
			curtop += obj.offsetTop;
		}
		while (obj = obj.offsetParent);
	}
	
	var result = [curleft,curtop];	
	return result;
};
	
/**
 * Generates a colour code randomly
 * @returns <String> colour code in the #RRGGBB format
 */ 
UTILS.getRandomColour = function() 
{
	var letters = '0123456789ABCDEF'.split('');
	var color = '#';
	for (var i = 0; i < 6; i++ ) {
		color += letters[Math.round(Math.random() * 15)];
	}
	return color;
};
	
/**
 * Verifies if a certain value is a number
 * @param n - value to be verified
 * @returns <Bool> true if n is a number, false otherwise
 */ 
UTILS.isNumber = function(n) 
{
	return !isNaN(parseFloat(n)) && isFinite(n);
};
	
/**
 * Determines if a point is inside a certain area
 * @param point - array with 2 positions representing the x, y coordinates of an element
 * @param area - array with 4 positions representing the area to be tested
 */ 
UTILS.contains = function( point, area )
{
	return ( point[0] >= area[0] && point[0] <= area[2] ) && ( point[1] >= area[1] && point[1] <= area[3] );
};

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/math/is-point-in-poly [rev. #0]

UTILS.isPointInPoly = function (poly, pt){
    for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
        ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
        && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
        && (c = !c);
    return c;
}

UTILS.deg2rad = function(angle) 
{
  //  discuss at: http://phpjs.org/functions/deg2rad/
  // original by: Enrique Gonzalez
  // improved by: Thomas Grainger (http://graingert.co.uk)
  //   example 1: deg2rad(45);
  //   returns 1: 0.7853981633974483

  return angle * .017453292519943295; // (angle / 180) * Math.PI;
};
