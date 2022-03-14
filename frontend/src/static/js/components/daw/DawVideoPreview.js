import React, { useCallback, useState, useRef, useEffect } from 'react'

export default function DawVideoPreview() {
    const canvasEl = useRef(null);
    const [frame, setFrame] = useState(0);

    useEffect(()=>{
        const timerID = setInterval(
            () => tick(),
            20 // Every 20ms, i.e. a framerate of 50 FPS.
        );
        return () => {
            clearInterval(timerID);
        }
    })

    // Ref: React clock example:
    // https://reactjs.org/docs/state-and-lifecycle.html
    function tick() { setFrame(frame+1); }

    function drawFrameOnCanvas() {
        const v_id = "vjs_video_3" // TODO: Observed from console log. More reliable way?
        const v = document.querySelector(`video#${v_id}, #${v_id} video`); // https://stackoverflow.com/q/71449615/3405291
        var canvas = canvasEl.current;
        var context = canvas.getContext('2d');
        var cw = Math.floor(canvas.clientWidth);
        var ch = Math.floor(canvas.clientHeight);
        canvas.width = cw;
        canvas.height = ch;
        context.drawImage(v, 0, 0, w, h);
        return null
    }

    return (
        <>
            <canvas className="video-preview" id="video-preview" ref={canvasEl}>
                {(frame > -1) ? drawFrameOnCanvas(): null}
            </canvas>
        </>
    )
}