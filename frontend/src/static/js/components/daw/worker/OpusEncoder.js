/*!
 * Copyright © 2014 Rainer Rillke <lastname>@wikipedia.de
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

/*global self: false, Runtime: false, OpusEncoder: false, Module: false, FS: false, EmsArgs: false, console: false, WebAssembly: false */
/*jslint vars: false,  white: false */
/*jshint onevar: false, white: false, laxbreak: true, worker: true, strict: false */

( function( global ) {
	'use strict';
	var MainScriptLoader,
		downloadCompleted,
		downloadError;

	/**
	 * Manages encoding and progress notifications
	 *  @class OpusEncoder
	 *  @singleton
	 */
	global.OpusEncoder = {
		encode: function( data ) {
			OpusEncoder.setUpLogging( data );
			OpusEncoder.monitorWWDownload();
			MainScriptLoader.downloadAndExecute( data, function() {
				// Before execute main script ...
				if ( !global.EmsArgs ){
					importScripts( 'EmsArgs.js' );
				}
				OpusEncoder.setUpModule( data );
			}, function() {
				// After the main script was executed ...
				MainScriptLoader.whenInitialized( function() {
					OpusEncoder._encode( data );
				} );
			} );
		},

		prefetch: function( data ) {
			if ( global.Module && global.EmsArgs && global.Runtime ) {
				return;
			}
			OpusEncoder.setUpLogging( data );
			MainScriptLoader.xhrload( data );
			importScripts( 'EmsArgs.js' );
		},

		setUpLogging: function( data ) {
			if ( !global.console ) global.console = {};
			console.log = function() {
				( data.log || OpusEncoder.log )(
					Array.prototype.slice.call( arguments )
				);
			};

			console.error = function() {
				( data.err || OpusEncoder.err )(
					Array.prototype.slice.call( arguments )
				);
			};
		},

		monitorWWDownload: function() {
			var lastLog = 0;

			MainScriptLoader.onDownloadComplete = function() {
				console.log( 'Worker downloaded successfully.' );
			};

			MainScriptLoader.onDownloadProgress = function( loaded, total ) {
				var now = Date.now(),
					diff = now - lastLog;

				if ( diff > 450 ) {
					lastLog = now;
					console.log( 'Downloading Opus Encoder code ... ' + Math.round( 100 * loaded / total, 2) + '%' );
				}
			};
			MainScriptLoader.onDownloadError = function( err ) {
				console.log( 'Failed to download worker utilizing XHR.\n' + err + '\nTrying importScripts() ...' );
			};
		},

		setUpModule: function( data ) {
			/*jshint forin:false */
			var totalFileLength = 0,
				filename, memRequired;

			for ( filename in data.fileData ) {
				if ( !data.fileData.hasOwnProperty( filename ) ) {
					return;
				}
				var fileData = data.fileData[filename];

				totalFileLength += fileData.length;
			}

			memRequired = totalFileLength * 2 + 0x1000000;
			// Currently "The asm.js rules specify that the heap size must be
			// a multiple of 16MB or a power of two. Minimum heap size is 64KB"
			// If we don't correct it here asm will dump errors on us while adjusting
			// the number but we would ignore following the error and shut down the
			// worker due to this error
			memRequired = memRequired - ( memRequired % 0x1000000 ) + 0x1000000;

			global.Module = {
				TOTAL_MEMORY: memRequired,
				_main: MainScriptLoader.initialized,
				noExitRuntime: true,
				preRun: OpusEncoder.setUpFilesystem,
				printErr: console.error.bind( console ),
				monitorRunDependencies: function( runDeps ) {
					console.log( 'Loading run dependencies. Outstanding: ' + runDeps );
				},
				locateFile: function( memFile ) {
					return memFile
						.replace( /^opusenc\.(html|js)\.mem$/, 'asm/opusenc.mem.png' )
						.replace( 'opusenc.wasm', 'wasm/opusenc.wasm.png' );
				}
			};
		},

		setUpFilesystem: function() {
			var infoBuff = '',
				errBuff = '',
				lastInfoFlush = Date.now(),
				lastErrFlush = Date.now(),
				infoTimeout, errTimeout, flushInfo, flushErr;

			OpusEncoder.flushInfo = flushInfo = function() {
				clearTimeout( infoTimeout );
				lastInfoFlush = Date.now();
				if ( infoBuff.replace( /\s*/g, '' ) ) {
					console.log( infoBuff );
					infoBuff = '';
				}
			};
			OpusEncoder.flushErr = flushErr = function() {
				clearTimeout( errTimeout );
				lastErrFlush = Date.now();
				if ( errBuff.replace( /\s*/g, '' ) ) {
					console.log( errBuff );
					errBuff = '';
				}
			};

			FS.init( global.prompt || function() {
				console.log( 'Input requested from within web worker. Returning empty string.' );
				return '';
			}, function( infoChar ) {
				infoBuff += String.fromCharCode( infoChar );
				clearTimeout( infoTimeout );
				infoTimeout = setTimeout( flushInfo, 5 );
				if ( lastInfoFlush + 700 < Date.now() ) {
					flushInfo();
				}
			}, function( errChar ) {
				errBuff += String.fromCharCode( errChar );
				clearTimeout( errTimeout );
				errTimeout = setTimeout( flushErr, 5 );
				if ( lastErrFlush + 700 < Date.now() ) {
					flushErr();
				}
			} );
		},

		done: function( args ) {
			global.postMessage( {
				reply: 'done',
				values: args
			} );
		},

		progress: function( args ) {
			global.postMessage( {
				reply: 'progress',
				values: args
			} );
		},

		log: function( args ) {
			global.postMessage( {
				reply: 'log',
				values: args
			} );
		},

		err: function( args ) {
			global.postMessage( {
				reply: 'err',
				values: args
			} );
		},

		_encode: function( data ) {
			/*jshint forin:false */
			var fPointer;

			// Get a pointer for the callback function
			fPointer = Runtime.addFunction( function( encoded, total, seconds ) {
				var filename, fileContent, b;

				// We *know* that writing to to stdin and/or stderr completed
				OpusEncoder.flushInfo();
				OpusEncoder.flushErr();

				if ( encoded === total && encoded === 100 && seconds === -1 ) {
					// Read output files
					for ( filename in data.outData ) {
						if ( !data.outData.hasOwnProperty( filename ) ) {
							return;
						}
						fileContent = FS.readFile( filename, {
							encoding: 'binary'
						} );
						b = new Blob(
							[fileContent],
							{type: data.outData[filename].MIME}
						);
						data.outData[filename].blob = b;
					}
					(data.done || OpusEncoder.done)( data.outData );
				} else {
					(data.progress || OpusEncoder.progress)(
						Array.prototype.slice.call( arguments )
					);
				}
			} );

			// Set module arguments (command line arguments)
			var args = data.args,
				argsCloned = args.slice( 0 );

			args.unshift( 'opusenc.js' );
			Module['arguments'] = argsCloned;

			// Create all neccessary files in MEMFS or whatever
			// the mounted file system is
			var filename;

			for ( filename in data.fileData ) {
				if ( !data.fileData.hasOwnProperty( filename ) ) {
					return;
				}
				var fileData = data.fileData[filename],
					stream = FS.open( filename, 'w+' );

				FS.write( stream, fileData, 0, fileData.length );
				FS.close( stream );
			}

			// Create output files
			for ( filename in data.outData ) {
				if ( !data.outData.hasOwnProperty( filename ) ) {
					return;
				}
				FS.close( FS.open( filename, 'w+' ) );
			}

			// Prepare C function to be called
			var encode_buffer = Module.cwrap( 'encode_buffer', 'number', ['number', 'number', 'number'] );

			// Copy command line args to Emscripten Heap and get a pointer to them
			EmsArgs.cArgsPointer( args, function( pointerHeap ) {
				try {
					global.Module.noExitRuntime = false;
					encode_buffer( args.length, pointerHeap.byteOffset, fPointer );
				} catch ( ex ) {
					console.error( ex.message || ex );
				}
			} );
		}
	};

	/**
	 * Downloads main script
	 *  @class MainScriptLoader
	 *  @singleton
	 *  @private
	 */
	MainScriptLoader = {
		name: ( global.WebAssembly ? 'wasm/' : 'asm/' ) + 'opusenc.js',
		text: null,
		status: 'idle',
		xhrload: function( data, complete, err ) {
			var xhrfailed = function( errMsg ) {
				if ( MainScriptLoader.status !== 'loading' ) {
					return;
				}
				MainScriptLoader.status = 'xhrfailed';
				MainScriptLoader.onDownloadError( errMsg );
				if ( err ) err();
			};

			if ( global.__debug ) {
				MainScriptLoader.status = 'loading';
				return xhrfailed( 'Debug modus enabled.' );
			}

			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if ( xhr.readyState === xhr.DONE ) {
					if ( xhr.status === 200 || xhr.status === 0 && location.protocol === 'file:' ) {
						MainScriptLoader.text = xhr.responseText;
						MainScriptLoader.status = 'loaded';
						MainScriptLoader.onDownloadComplete();
						if ( complete ) complete();
						if ( downloadCompleted ) downloadCompleted();
					} else {
						xhrfailed( 'Server status ' +  xhr.status );
					}
				}
			};
			xhr.onprogress = function( e ) {
				if ( e.lengthComputable ) {
					MainScriptLoader.onDownloadProgress( e.loaded, e.total );
				}
			};
			xhr.onerror = function() {
				xhrfailed( 'There was an error with the request.' );
			};
			xhr.ontimeout = function() {
				xhrfailed( 'Request timed out.' );
			};

			try {
				MainScriptLoader.status = 'loading';
				xhr.open( 'GET', MainScriptLoader.name );
				xhr.send( null );
			} catch ( ex ) {
				xhrfailed( ex.message || ex );
			}
		},
		onDownloadProgress: function( /* loaded, total */ ) {},
		onDownloadComplete: function() {},
		onDownloadError: function( /* description */ ) {},
		downloadAndExecute: function( data, beforeExecution, afterExecution ) {
			switch ( MainScriptLoader.status ) {
				case 'idle':
					MainScriptLoader.xhrload( data, function() {
						beforeExecution();
						MainScriptLoader.execute();
						afterExecution();
					}, function() {
						beforeExecution();
						importScripts( MainScriptLoader.name );
						afterExecution();
					} );
					break;
				case 'xhrfailed':
					beforeExecution();
					importScripts( MainScriptLoader.name );
					afterExecution();
					break;
				case 'loaded':
					beforeExecution();
					MainScriptLoader.execute();
					afterExecution();
					break;
				case 'loading':
					downloadCompleted = function() {
						downloadCompleted = null;
						downloadError = null;
						beforeExecution();
						MainScriptLoader.execute();
						afterExecution();
					};
					downloadError = function() {
						beforeExecution();
						importScripts( MainScriptLoader.name );
						afterExecution();
					};
					break;
			}
		},
		execute: function() {
			if ( !MainScriptLoader.text ) {
				throw new Error( 'Main script text must be loaded before!' );
			}
			global.callEval( MainScriptLoader.text );
		},
		queue: [],
		isInitialized: false,
		whenInitialized: function( cb ) {
			if ( MainScriptLoader.isInitialized ) {
				cb();
			} else {
				MainScriptLoader.queue.push( cb );
			}
		},
		initialized: function() {
			MainScriptLoader.isInitialized = true;
			while ( MainScriptLoader.queue.length ) {
				MainScriptLoader.queue.shift()();
			}
		}
	};

}( self ) );

( function( global ) {
	/* jshint evil: true */
	global.callEval = function ( s ) {
		var Module = global.Module,
			ret = eval( s );

		global.FS = FS;
		global.Module = Module;
		global.Runtime = Runtime;
		return ret;
	};
}( self ) );
