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

/*global self: false, Module:false */
/*jslint vars: false,  white: false */
/*jshint onevar: false, white: false, laxbreak: true */
( function( global ) {
	'use strict';

	/**
	 * Emscripten C function arguments utitlites
	 *  @class EmsArgs
	 *  @singleton
	 */
	global.EmsArgs = {
		/**
		 * Read a Blob as ArrayBuffer and invoke the supplied callback when completed
		 *
		 *  @param {Blob}           blob  Blob to be read
		 *  @param {Function}         cb  Callback invoked upon completion of the
		 *                                operation
		 *  @param {ArrayBuffer} cb.data  ArrayBuffer containing a copy of the Blob data
		 */
		readBlobAsArrayBuffer: function readBlobAsArrayBuffer( blob, cb ) {
			var frs, fr;

			if ( global.FileReaderSync ) {
				frs = new FileReaderSync();
				// Ensure ASYNC callback
				// TODO: Investigate why application crashes (exit(1))
				// when using synchroneous callback here
				setTimeout( function() {
					cb( frs.readAsArrayBuffer( blob ) );
				}, 5 );
				return;
			}

			fr = new FileReader();
			fr.addEventListener( 'loadend', function() {
				cb( fr.result );
			} );
			fr.readAsArrayBuffer( blob );
		},

		
		/**
		 *  @param {string}           s  String to be UTF-8 encoded as buffer
		 *  @param {Function}        cb  Callback when string has been converted
		 *  @param {number} cb.sPointer  Pointer to the string
		 */
		getBufferFor: function( s, cb ) {
			var b = new Blob( [ s + '\0' ] );
			global.EmsArgs.readBlobAsArrayBuffer( b, function( res ) {
				var arg = new Uint8Array( res );
				var dataPtr = Module._malloc( arg.length * arg.BYTES_PER_ELEMENT );

				// Copy data to Emscripten heap
				var dataHeap = new Uint8Array( Module.HEAPU8.buffer, dataPtr, arg.length * arg.BYTES_PER_ELEMENT );
				dataHeap.set( arg );
				cb( dataPtr );
			} );
		},

		/**
		 *  @param {Array}            args  Arguments to be passed to the C function.
		 *  @param {Function}           cb  Callback when arguments were converted
		 *  @param {number} cb.argsPointer  A pointer to the the Array of Pointers of arguments
		 *                                  in the Emscripten Heap (**argv)
		 */
		cArgsPointer: function( args, cb ) {
			var pointers = new Uint32Array( args.length ),
				nextArg, processedArg;

			args = args.slice( 0 );

			processedArg = function( sPointer ) {
				pointers[ pointers.length - args.length - 1 ] = sPointer;
				nextArg();
			};

			nextArg = function() {
				if ( args.length ) {
					global.EmsArgs.getBufferFor( args.shift(), processedArg );
				} else {
					var nPointerBytes = pointers.length * pointers.BYTES_PER_ELEMENT;
					var pointerPtr = Module._malloc( nPointerBytes );
					var pointerHeap = new Uint8Array( Module.HEAPU8.buffer, pointerPtr, nPointerBytes );
					pointerHeap.set( new Uint8Array( pointers.buffer ) );
					cb( pointerHeap );
				}
			};
			nextArg();
		}
	};

}( self ) );
