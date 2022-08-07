import React, { useState } from "react";
import { PageActions, MediaPageActions } from '../../utils/actions/';

export default function DawSync({ ee }) {

    const [madeChanges, setMadeChanges] = useState(false);

    function onVoiceSubmit() {
        setMadeChanges(false);
    }

    function onVoiceSubmitFail() {
        setMadeChanges(false);
    }

    function submitVoice() {
        if (!madeChanges) {
            return;
        }
        MediaPageActions.submitVoice(val);
    }

    return (
      <div className="daw-sync-outer">
        <div className="daw-sync" id="daw-sync">
          <button
            type="button"
            id="btn-drop"
            className="btn btn-outline-dark"
            title="Submit or upload the current work as a voice file"
            onClick={(event) => {
              // Sync voices with database.
              // Delete removed ones. Add new ones.
              submitVoice();
            }}
          >
            <svg
              xmlns:dc="http://purl.org/dc/elements/1.1/"
              xmlns:cc="http://creativecommons.org/ns#"
              xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
              xmlns:svg="http://www.w3.org/2000/svg"
              xmlns="http://www.w3.org/2000/svg"
              xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
              xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
              inkscape:export-ydpi="300"
              inkscape:export-xdpi="300"
              inkscape:export-filename="C:\Users\m3\Downloads\logo.png"
              sodipodi:docname="logo.svg"
              viewBox="0 0 96 96"
              height="96"
              width="96"
              inkscape:version="1.0 (4035a4fb49, 2020-05-01)"
              version="1.1"
              id="svg8770"
            >
              <metadata id="metadata8776">
                <rdf:RDF>
                  <cc:Work rdf:about="">
                    <dc:format>image/svg+xml</dc:format>
                    <dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
                    <dc:title></dc:title>
                  </cc:Work>
                </rdf:RDF>
              </metadata>
              <defs id="defs8774" />
              <sodipodi:namedview
                inkscape:document-rotation="0"
                inkscape:current-layer="svg8770"
                inkscape:window-maximized="1"
                inkscape:window-y="-8"
                inkscape:window-x="56"
                inkscape:cy="82.982604"
                inkscape:cx="134.1121"
                inkscape:zoom="1.8172644"
                showgrid="false"
                id="namedview8772"
                inkscape:window-height="745"
                inkscape:window-width="1302"
                inkscape:pageshadow="2"
                inkscape:pageopacity="0"
                guidetolerance="10"
                gridtolerance="10"
                objecttolerance="10"
                borderopacity="1"
                bordercolor="#666666"
                pagecolor="#ffffff"
              />
              <path
                inkscape:connector-curvature="0"
                id="path8780"
                d="m 33.286364,14.250015 7.155785,12.10979 14.586793,6.054896 -7.431008,11.008895 0.550445,4.678786 -17.889459,5.504453"
                style="fill:none;fill-rule:evenodd;stroke:#422ca6;stroke-width:4.50003;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
              />
              <path
                inkscape:connector-curvature="0"
                id="path8792"
                d="M 19.250015,31.589034 C 25.855356,36.818265 31.910253,28.01114 31.910253,28.01114"
                style="fill:none;fill-rule:evenodd;stroke:#422ca6;stroke-width:4.50003;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
              />
              <path
                inkscape:connector-curvature="0"
                id="path8794"
                d="M 46.221824,69.019294 C 29.158032,65.441396 30.534143,53.05639 30.534143,53.05639"
                style="fill:none;fill-rule:evenodd;stroke:#422ca6;stroke-width:4.50003;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
              />
              <path
                inkscape:connector-curvature="0"
                id="path8798"
                d="m 55.579386,53.606835 c 9.632785,10.183228 0.825667,15.962903 0.825667,15.962903"
                style="fill:none;fill-rule:evenodd;stroke:#422ca6;stroke-width:4.50003;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
              />
              <path
                inkscape:connector-curvature="0"
                id="path8800"
                d="m 61.359061,47.82716 c 15.687678,19.816023 0.825666,29.999253 0.825666,29.999253"
                style="fill:none;fill-rule:evenodd;stroke:#422ca6;stroke-width:4.50003;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
              />
              <path
                inkscape:connector-curvature="0"
                id="path8802"
                d="m 68.239624,41.497041 c 19.540801,26.146142 0.275222,41.558606 0.275222,41.558606"
                style="fill:none;fill-rule:evenodd;stroke:#422ca6;stroke-width:4.50003;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
              />
            </svg>
          </button>
        </div>
      </div>
    );
}
