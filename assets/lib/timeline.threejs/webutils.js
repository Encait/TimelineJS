
/**
 * Utility functions
 */ 
function WEB_UTILS()
{
	this.VERSION = "1";
}

/**
 * Generates a uuid...
 * @returns <String> random uuid
 */ 
WEB_UTILS.generateUUID = function()
{
	var charset = "abcdefghijklmnopqrstuvwxyz0123456789";
	return 	WEB_UTILS.generateRandomString(8, charset)+"-"+
			WEB_UTILS.generateRandomString(4, charset)+"-"+
			WEB_UTILS.generateRandomString(4, charset)+"-"+
			WEB_UTILS.generateRandomString(4, charset)+"-"+
			WEB_UTILS.generateRandomString(12, charset);	
};
	
/**
 * Generates a random string
 * @param size <Integer> size of the string to be generated
 * @param charset <Array:<String>> string with the characters that can be used to generate the string
 * @returns <String> random string
 */
WEB_UTILS.generateRandomString = function(size, charset)
{
	var randomString = "";
	for( var i = 0; i < size; i ++ )
		randomString += charset.charAt(Math.floor(Math.random()*charset.length));
	return randomString;
};

/**
 * 
 */
WEB_UTILS.generateGradientTexture = function( startColour, endColour, startAlpha, endAlpha ) {
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
WEB_UTILS.scaleDimension = function( domain, range, input )
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
WEB_UTILS.findObjectPosition = function(obj) 
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
	return [curleft,curtop];
};
	
/**
 * Generates a colour code randomly
 * @returns <String> colour code in the #RRGGBB format
 */ 
WEB_UTILS.getRandomColour = function() 
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
WEB_UTILS.isNumber = function(n) 
{
	return !isNaN(parseFloat(n)) && isFinite(n);
};
	
/**
 * Determines if a point is inside a certain area
 * @param point - array with 2 positions representing the x, y coordinates of an element
 * @param area - array with 4 positions representing the area to be tested
 */ 
WEB_UTILS.contains = function( point, area )
{
	return ( point[0] > area[0] && point[0] < area[2] ) && ( point[1] > area[1] && point[1] < area[3] );
};

WEB_UTILS.deg2rad = function(angle) 
{
  //  discuss at: http://phpjs.org/functions/deg2rad/
  // original by: Enrique Gonzalez
  // improved by: Thomas Grainger (http://graingert.co.uk)
  //   example 1: deg2rad(45);
  //   returns 1: 0.7853981633974483

  return angle * .017453292519943295; // (angle / 180) * Math.PI;
};

WEB_UTILS.seconds2hms = function( seconds )
{
	var textualTimestamp = "";
	var date = new Date(seconds*1000);
	textualTimestamp = 	( (date.getHours() < 10)? "0"+(date.getHours()) : (date.getHours()) ) +":"+ 
						((date.getMinutes() < 10)? "0"+(date.getMinutes()) : (date.getMinutes() )) +":"+
						((date.getSeconds() < 10)? "0"+(date.getSeconds()) : (date.getSeconds() ));	
	
	return textualTimestamp;
};
