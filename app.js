const speedEl = document.getElementById("speed");
const statusEl = document.getElementById("status");

if (!navigator.geolocation) {
    speedEl.textContent = "지원 안 됨";
    statusEl.textContent = "이 브라우저는 Geolocation API를 지원하지 않습니다.";
} else {
    statusEl.textContent = "실제 위치/속도 데이터를 기다리는 중입니다.";

    navigator.geolocation.watchPosition(
        (position) => {
            const speedMps = position.coords.speed;

            if (speedMps == null) {
                speedEl.textContent = "측정 불가";
                statusEl.textContent = "이 기기/브라우저는 현재 speed 값을 제공하지 않습니다.";
                return;
            }

            const speedKmh = speedMps * 3.6;
            speedEl.textContent = `${speedKmh.toFixed(1)} km/h`;
            statusEl.textContent = `실제 위치 데이터 수신 중 · 정확도 ${Math.round(position.coords.accuracy)}m`;
        },
        (error) => {
            speedEl.textContent = "오류";
            statusEl.textContent = `위치 오류: ${error.message}`;
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        }
    );
}