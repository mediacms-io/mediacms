import React, { useState, useRef, useEffect } from 'react'

export default function DawVideoPreview({playerInstance}) {
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
        const v_id = playerInstance.player.id_;
        const v = document.querySelector(`video#${v_id}, #${v_id} video`); // https://stackoverflow.com/q/71449615/3405291
        const canvas = canvasEl.current;
        if (!v || !canvas) {
            return;
        }
        const v_w = v.videoWidth;
        const v_h = v.videoHeight;
        const context = canvas.getContext('2d');
        let w = Math.floor(canvas.clientWidth);
        let h = Math.floor(canvas.clientHeight);
        // https://stackoverflow.com/a/1373879/3405291
        const scale = Math.min(w / v_w, h / v_h);
        const width = v_w * scale;
        const height = v_h * scale;
        const centerShift_x = (w - width) / 2;
        const centerShift_y = (h - height) / 2;
        // https://stackoverflow.com/a/23105310/3405291
        context.clearRect(0, 0, w, h);
        context.drawImage(v, 0, 0, v_w, v_h, centerShift_x, centerShift_y, width, height);
    }

    return <canvas className="video-preview" id="video-preview" ref={canvasEl}></canvas>
}
