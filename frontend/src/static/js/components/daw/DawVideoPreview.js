import React, { useState, useRef, useEffect } from 'react'

export default function DawVideoPreview() {
    const canvasEl = useRef(null);

    useEffect(()=>{
        const timerID = setInterval(
            () => tick(),
            42 // 1000/42 ~ 24 fps. This is the standard for movies and TV shows. Right?
        );
        return () => {
            clearInterval(timerID);
        }
    })

    // Ref: React clock example:
    // https://reactjs.org/docs/state-and-lifecycle.html
    function tick() {
        const v_id = "vjs_video_3"; // TODO: Observed from console log. More reliable way?
        const v = document.querySelector(`video#${v_id}, #${v_id} video`); // https://stackoverflow.com/q/71449615/3405291
        const canvas = canvasEl.current;
        if (!v || !canvas) {
            return;
        }
        const context = canvas.getContext('2d');
        let w = Math.floor(canvas.clientWidth);
        let h = Math.floor(canvas.clientHeight);
        canvas.width = w;
        canvas.height = h;
        context.drawImage(v, 0, 0, w, h);
    }

    return <canvas className="video-preview" id="video-preview" ref={canvasEl}></canvas>
}
