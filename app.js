const speedEl = document.getElementById("speed");

if (!navigator.geolocation) {
    speedEl.textContent = "지원 안 됨";
} else {
    navigator.geolocation.watchPosition(
        (position) => {
            const speedMps = position.coords.speed ?? 0;
            const speedKmh = speedMps * 3.6;
            speedEl.textContent = `${speedKmh.toFixed(1)} km/h`;
        },
        () => {
            speedEl.textContent = "위치 오류";
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        }
    );
}