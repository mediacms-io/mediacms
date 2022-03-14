import React, { useCallback, useState, useEffect } from 'react'

import '../daw/style.css'
import '../daw/responsive.css'

export default function DawVideoPreview() {
    const canvasEl = useCallback((node) => {
        const v_id = "vjs_video_3" // TODO: Observed from console log. More reliable way?
        const v = document.querySelector(`video#${v_id}, #${v_id} video`); // https://stackoverflow.com/q/71449615/3405291
        if (!v) {
            return
        }
        var canvas = node;
        var context = canvas.getContext('2d');
        var w = Math.floor(canvas.clientWidth);
        var h = Math.floor(canvas.clientHeight);
        canvas.width = w;
        canvas.height = h;
        context.drawImage(v, 0, 0, w, h);
    }, [frame]);

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

    return (
        <>
            <canvas className="video-preview" id="video-preview" ref={canvasEl}></canvas>
        </>
    )
}