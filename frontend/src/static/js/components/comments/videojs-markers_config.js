//markers on the timebar
const markerStyle = {
    width: "15px",
    "background-color": "#DD7373"
};

//the comment overlay
const overlayStyle = {
    width: "100%",
    height: "auto",
};

function enableMarkers(video) {
    if (!(typeof video.markers === 'object')) {
        video.markers({
            markerStyle: markerStyle,
            markerTip: {
                display: true,
                text: function (marker) {
                    return marker.text;
                }
            },
            breakOverlay: {
                display: true,
                displayTime: 20,
                text: function (marker) {
                    return marker.text;
                },
                style : overlayStyle
            },
            markers: []
        });
    }
}

function addMarker(videoPlayer, time, text)
{
  videoPlayer.markers.add([{
    time: time,
    text: text
  }]);
}

export {enableMarkers, addMarker};