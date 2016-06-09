import * as ServerCompatUtil from '@redfin/server-compat-util';
import Cookie from '@redfin/cookie';

const REGEX_KNOWN_MOBILE_DEVICE = /Redfin|Android|AgentTools|bb\d+|Kindle|Silk|blackberry|iemobile|ip(hone|od|ad)|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|symbian|treo|up\.(browser|link)|windows (ce|phone)|xda|xiino/i;
const REGEX_KNOWN_PHONE_DEVICE = /Redfin|(Android.+Mobile|Mobile.+Android)|AgentTools|bb\d+|Kindle|Silk|blackberry|iemobile|ip(hone|od)|opera m(ob|in)i|palm(os)?|phone|p(ixi|re)\/|symbian|treo|up\.(browser|link)|windows(ce|phone)|xda|xiino/i;

// Copied from BrowserDetect.java
const REGEX_KNOWN_IOS_DEVICE = /\biPhone\b|iPod|\biPad\b/;
const REGEX_KNOWN_ANDROID_DEVICE = /Android[ -](\d+(\.\d+)?(\.\d+)?)/;

// Browser version specific user agents
const REGEX_FIREFOX = /Firefox/;
const REGEX_CHROME = /Chrome\//;
const REGEX_OPERA = /Opera/;
const REGEX_TRIDENT = /Trident\/.*([0-9]+[.0-9]*)/; // IE's rendering engine
const REGEX_IE_10_OR_LESS = /MSIE ([0-9]+[\.0-9]*)/;
const REGEX_IE_11 = REGEX_TRIDENT; // FIXME: This does not actually detect IE11!

// These are the breakpoints that the UX Team has identified as our
// major pivots.  They are also written into _media-queries.less in
// the less preable and are assumed to be in sync.
const SCREEN_SIZE_CONFIG = [
	//*IMPORTANT* - Keep this ordered by size
	['tiny',      0],
	['small',   400],
	['medium',  600],
	['large',   900],
	['huge',   1200],
];

const screenSizes = {};

SCREEN_SIZE_CONFIG.forEach((tuple, index) => {
	// This is exported as a unit-independent yet order-correct
	// enumeration of available screen sizes.
	screenSizes[tuple[0].toUpperCase()] = index;
});



const TESTS = {
	'css-transitions': () => _supportsCSS('transition'),
	'css-columns': () => _supportsCSS('columnCount'),
	'css-generated-content': () => _supportsCSS('content'),
	'css-opacity': () => _supportsCSS('opacity'),
	'events-touch': () => _supportsTouchEvents(),
	'geolocation': () => _supportsGeolocation(),
	'screen-size': () => _screenSize(),
	'screen-size-tiny': () => _screenSize('tiny'),
	'screen-size-small': () => _screenSize('small'),
	'screen-size-medium': () => _screenSize('medium'),
	'screen-size-large': () => _screenSize('large'),
	'screen-size-huge': () => _screenSize('huge'),
	'html-prefetch-in-head': _doPrefetchInHead,
	'html-prefetch-in-iframe': _doPrefetchInIframe, // fallback for janky browsers
	'html-range': () => _supportsRangeInput(),
	'html-form-validation': () => _supportsHTMLFormValidation(),
	'html-form-validation-with-required-notice': () => _supportsHTMLFormValidationWithRequiredNotice(),
	'html-input-placeholder': () => _supportsInputPlaceholder(),
	'html-input-placeholder-on-focus': () => _supportsInputPlaceholderOnFocus(),
	'ios-app-store': () => _isIOSDevice(),
	'google-play-store': () => _isAndroidDevice(),
	'ios-web-view': () => _isIOSWebView(),
	'android-web-view': () => _isAndroidWebView(),
	'activex-object': () => _supportsActiveXObject(),
	'webgl': () => _supportsWebGl(),
	'history': () => _hasHistory(),
	'localstorage': () => _hasStorage('local'),
	'sessionstorage': () => _hasStorage('session'),
};




// Private Utilities

/**
 * PREFETCH SUPPORT ACROSS BROWSERS
 *
 * == Internet Explorer ==
 * IE10 treats <link rel="prefetch"> as a DNS prefetch, but does not eagerly fetch the asset itself.
 *		http://chimera.labs.oreilly.com/books/1230000000545/ch10.html#SPECULATIVE_HINTS
 * IE11 is basically perfect. Seems to wait until current page's resources are downloaded before prefetching.
 *		http://blogs.msdn.com/b/ie/archive/2013/12/04/getting-to-the-content-you-want-faster-in-ie11.aspx?Redirected=true
 *
 * == Safari ==
 * Not supported at all.
 *
 * == Blink (Chrome + Opera) ==
 * Works, but prefetches are requested BEFORE THE CURRENT PAGE'S CONTENT. EWWW.
 *		https://code.google.com/p/chromium/issues/detail?id=61476
 *
 * == Firefox ==
 * Works, and waits for current page to finish loading, but only downloads one asset at a time.
 * (In my experience, Firefox only downloads one asset *PERIOD*, then stops prefetching, but maybe that's just me. -- andrew.bartkus)
 * 		http://www.stevesouders.com/blog/2013/11/07/prebrowsing/
 */
function _doPrefetchInHead() {
	const userAgent = ServerCompatUtil.getRequestUserAgent();
	if (REGEX_CHROME.test(userAgent)) return false;
	if (REGEX_OPERA.test(userAgent)) return false;
	return true;
};
function _doPrefetchInIframe() {
	const userAgent = ServerCompatUtil.getRequestUserAgent();
	if (REGEX_FIREFOX.test(userAgent)) return false;
	if (REGEX_TRIDENT.test(userAgent) && !REGEX_IE_10_OR_LESS.test(userAgent)) return false;
	return true;
}


/**
* 	Get the size of the screen. Fails gracefully if not in the browser.
* 	@private
*/
function _measureScreen() {
	if (_inBrowser()) {
		return {
			w: Math.max(document.documentElement.scrollWidth, window.innerWidth || 0),
			h: Math.max(document.documentElement.scrollHeight, window.innerHeight || 0),
		}
	}
	return null;
};


/**
* 	Does the browser have the requested screen size?
*	@private
*	@param {string} The requested string size
*/
function _screenSize(requestedSize) {

	if (requestedSize
		&& typeof requestedSize == 'string'
		&& !screenSizes.hasOwnProperty(requestedSize.toUpperCase())
		) {
		console.error('FeatureDetect.screenSize() has encounted an unknown screen size: ' + requestedSize);
		return null;
	}

	// Get size string of current browser, or fall back to known mobile devices.
	const screenMeasurements = _measureScreen();
	let screenIndex, screenSize;
	if (screenMeasurements) {
		SCREEN_SIZE_CONFIG.forEach((key, index) => {
			if (screenMeasurements.w >= key[1]) {
				screenIndex = index;
				screenSize = key[0];
			}
		});
	} else {
		// We're going to take a WAG here and let the backend
		// proceed as best as possible.  This may result in a change
		// in the browser for devices that we're not familiar with
		// but thats better than never correcting ourselves.
		if (_isKnownPhoneDevice()) {
			screenIndex = screenSizes.SMALL;
		} else if (_isKnownTabletDevice()) {
			screenIndex = screenSizes.MEDIUM;
		} else {
			screenIndex = screenSizes.LARGE;
		}
	}

	// Match to request
	if (requestedSize) {
		return screenSize === requestedSize;
	} else {
		return screenIndex;
	}
};


/**
* 	Is this currently running in a browser?
*	@private
*/
function _inBrowser() {
	return (
		typeof window !== "undefined" &&
		typeof location !== "undefined" &&
		typeof document !== "undefined" &&
		window.location === location && window.document === document
	);
};


// Tests for various CSS property support
// Concept from http://code.tutsplus.com/tutorials/quick-tip-detect-css3-support-in-browsers-with-javascript--net-16444
function _supportsCSS(prop) {
	if (_inBrowser()) {
		const div = document.createElement('div');
		const vendors = 'Khtml Ms O Moz Webkit'.split(' ');
		let len = vendors.length;

		// Unprefixed Prop
		if (prop in div.style) {return true; }

		// Prefixed Prop
		prop = prop.replace(/^[a-z]/, val => {
			return val.toUpperCase();
		});
		while(len--) {
			if (vendors[len] + prop in div.style ) {
				return true;
			};
		}
		return false;
	} else {
		return true;
	}
}


/**
* 	Is the user agent a known "phone" device?
*	@private
*/
function _isKnownPhoneDevice() {
	if (REGEX_KNOWN_PHONE_DEVICE.test(ServerCompatUtil.getRequestUserAgent())) {
		return true;
	}
	return false;
};


/**
* 	Is the user agent a known "tablet" device?
*	@private
*/
function _isKnownTabletDevice() {
	if (REGEX_KNOWN_MOBILE_DEVICE.test(ServerCompatUtil.getRequestUserAgent())) {
		if (!REGEX_KNOWN_PHONE_DEVICE.test(ServerCompatUtil.getRequestUserAgent())) {
			return true;
		}
	}
	return false;
};


/**
 * Is the user agent an iOS device (i.e., iPhone, iPad, or iPod)?
 * @private
 */
function _isIOSDevice() {
	if (REGEX_KNOWN_IOS_DEVICE.test(ServerCompatUtil.getRequestUserAgent())) {
		return true;
	}
	return false;
};


/**
 * Is the user agent an Android device?
 * @private
 */
function _isAndroidDevice() {
	if (REGEX_KNOWN_ANDROID_DEVICE.test(ServerCompatUtil.getRequestUserAgent())) {
		return true;
	}
	return false;
};

/**
 * Is the user agent an iOS webview
 * @private
 */
function _isIOSWebView() {
	// ios webviews don't have safari in the user agent
	return _isIOSDevice() && !(/Safari/.test(ServerCompatUtil.getRequestUserAgent()));
};

/**
 * Is the user agent an android webview
 * @private
 */
function _isAndroidWebView() {
	// android webviews have a version number
	return _isAndroidDevice() && /Version\/\d\.\d/.test(ServerCompatUtil.getRequestUserAgent());
};


/**
 * Does the browser support WebGL?
 * @private
 */
function _supportsWebGl() {
	if (_inBrowser()) {
		try {
			const canvas = document.createElement( 'canvas' ); return !!( window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ) );
		} catch (e) {
			return false;
		};
	} else {
		const userAgent = ServerCompatUtil.getRequestUserAgent();
		const ieRegExp  = new RegExp("MSIE ([0-10]+[\.0-10]*)");
		return !ieRegExp.exec(userAgent);
	}
};


/**
* 	Does the device support touch events?
*	@private
*/

/* 	WARNING: Before you write any code that detects touch
		make sure you have read and understand these articles:

		https://github.com/Modernizr/Modernizr/issues/548
		http://www.html5rocks.com/en/mobile/touchandmouse/

		remeber that if you are attaching touch and click events
		to stop the event propigation on the touch event handler
		or you will get two events fired. -KCJ
*/
function _supportsTouchEvents() {
	if (_inBrowser()) {
		if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
			return true;
		}
		return false;
	}
	return true;
};


/**
 * Does the browser support the range HTML input.
 * @private
 */
function _supportsRangeInput() {
	// There's a wonderful bug with React range inputs in IE
	//   - https://github.com/facebook/react/issues/554
	// Until that's fixed, I'm going to consider the range input unsupported in IE
	const ieRegExp = new RegExp("MSIE");
	const ua = ServerCompatUtil.getRequestUserAgent();

	if (_inBrowser()) {
		return (typeof document.createRange != "undefined") && (typeof window.getSelection != "undefined") && !(ieRegExp.exec(ua) || (navigator.appName === 'Netscape' && REGEX_IE_11.test(ua)));
	}
	return true;
}


/**
 * Returns whether the `placeholder` attribute on input elements is supported.
 *
 * @returns {boolean} Returns true if the `placeholder` attribute is supported or if executed on the server.
 * @private
 */
function _supportsInputPlaceholder() {
	let result = true;

	if (_inBrowser()) {
		let input = document.createElement('input');
		result = ('placeholder' in input);
	}

	return result;
}


/**
 * Returns whether there is support for placeholder text to stay visible when the input element is both empty and
 * focused.
 *
 * In IE11, for instance, (which _does_ support the `placeholder` input element attribute) will hide the placeholder
 * text in an empty input element if the input element receives focus.
 *
 * @returns {boolean} Returns true if the placeholder in an input element does not hide when focused.
 * @private
 */
function _supportsInputPlaceholderOnFocus() {
	// Right now we know, for sure, IE11 does not support this functionality per this bug: RED-57788.
	return _supportsInputPlaceholder() && !_isIE11Browser();
}


/**
 * Feature detect whether there is support for `ActiveXObject`.
 *
 * @returns {boolean} Returns true if the `ActiveXObject` is present or if executed on the server.
 * @private
 */
function _supportsActiveXObject() {
	let result = true;

	if (_inBrowser()) {
		result = !!window.ActiveXObject || !('ActiveXObject' in window);
	}

	return result;
}

/**
* 	Does the browser suport HTML5 Validation
*	@private
*/
function _supportsHTMLFormValidation() {
	let result = true;

	if (_inBrowser()) {
		const input = document.createElement('input');
		result = ('checkValidity' in input);
	}

	return result;
}


/**
 * Some browers do not show a notice when a required field is empty: http://caniuse.com/#feat=form-validation.
 *
 * @returns {boolean}
 * @private
 */
function _supportsHTMLFormValidationWithRequiredNotice() {
	let result = true;

	if (_inBrowser()) {
		result = _supportsHTMLFormValidation() && !_isIOSDevice();
	}

	return result;
}


/**
 * Feature and UA detects whether the browser is Internet Explorer 11.
 *
 * Source: http://stackoverflow.com/a/21825207/1265126
 *
 * @returns {boolean} Returns true if the browser is detected to be IE11 or if executed on the server.
 * @private
 */
function _isIE11Browser() {
	let result = true;

	if (_inBrowser()) {
		const ua = ServerCompatUtil.getRequestUserAgent();
		result = !_supportsActiveXObject() && REGEX_IE_11.test(ua);
	}

	return result;
}

/**
 * Detects whether a browser supports geolocation.
 *
 * Source: https://github.com/Modernizr/Modernizr/blob/347ddb078116cee91b25b6e897e211b023f9dcb4/feature-detects/geolocation.js
 *
 * @returns {boolean} Returns a truthy value if the browser is detected to support HTML5 geoloation or
 *     if executed server-side.
 * @private
 */
function _supportsGeolocation() {
	let result = true;

	if (_inBrowser()) {
		result = ('geolocation' in navigator);
	}

	return result;
}

function _hasHistory() {
	return !!(window.history && window.history.pushState);
}

/**
 * Determines the following:
 * 1. Whether the browser supports `window.localStorage` or `window.sessionStorage`.
 * 2. Whether the browser has enabled `window.localStorage` or `window.sessionStorage`.
 *
 * Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#Testing_for_support_vs_availability
 *
 * @param {'local'|'session'} type The type of browser storage. (Either: 'local' or 'session')
 * @returns {boolean} Returns true if the current browser supports and has enabled the type of storage specified.
 * @private
 */
function _hasStorage(type) {
	var storageType = type && (type.toLowerCase() + 'Storage');

	if (['localStorage', 'sessionStorage'].indexOf(storageType) >= 0 && _inBrowser()) {
		// Browsers that support localStorage will have a property on the window object named localStorage. However, for
		// various reasons, just asserting that property exists may throw exceptions. If it does exist, that is still no
		// guarantee that localStorage is actually available, as various browsers offer settings that disable
		// localStorage. So a browser may support localStorage, but not make it available to the scripts on the page.
		// One example of that is Safari, which in Private Browsing mode gives us an empty localStorage object with a
		// quota of zero, effectively making it unusable. Our feature detect should take these scenarios into account.
		try {
			var storage = window[storageType],
				x = '__storage_test__';
			storage.setItem(x, x);
			storage.removeItem(x);
			return true;
		}
		catch (e) {
			return false;
		}
	} else {
		return false;
	}
}


// Public API

function has(testName) {

	// Check for valid input
	if (typeof testName !== 'string') {
		console.error('FeatureDetect.detect() requires a string of features to detect');
		return null;
	};

	// Set cookie data if not found.
	let cookieData = Cookie("RF_BROWSER_CAPABILITIES");
	if (cookieData && typeof cookieData === 'string') {
		cookieData = JSON.parse(cookieData);
	}
	if (!cookieData) {
		cookieData = {};
		if (_inBrowser()) {
			for (let test in TESTS) {
				if (TESTS.hasOwnProperty(test)) {
					cookieData[test] = TESTS[test]();
				}
			}
		}
	};

	let outcome = false;
	if (TESTS[testName]) {
		const cookieValue = cookieData[testName];
		if (_inBrowser() || cookieValue === undefined) {
			outcome = TESTS[testName]();
			cookieData[testName] = outcome;
		} else if (cookieValue !== undefined) {
			outcome = cookieValue
		} else {
			outcome = TESTS[testName]();
		}
	} else {
		console.error('FeatureDetect.detect() has encountered an unknown feature: ' + testName);
		return null;
	}

	if (_inBrowser()) {
		Cookie('RF_BROWSER_CAPABILITIES', JSON.stringify(cookieData), {expires: 30, domain: window.location.host, path: "/"});
	}
	return outcome;
}

// Numerical values for client size comparison with has('screen-size')
// We deliberately do not expose the exact pixel values because they
// may change slightly with new devices over time.
has.screenSizes = screenSizes;

export default has;
