const speedEl = document.getElementById("speed");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

let watchId = null;

function startTracking() {
    if (!navigator.geolocation) {
        speedEl.textContent = "지원 안 됨";
        statusEl.textContent = "이 브라우저는 위치 API를 지원하지 않습니다.";
        return;
    }

    statusEl.textContent = "위치 권한 요청 중입니다...";

    navigator.geolocation.watchPosition(
        (position) => {
            const speedMps = position.coords.speed;

            if (speedMps == null) {
                speedEl.textContent = "대기중";
                statusEl.textContent = `측정 대기중 입니다. 정확도: ${Math.round(position.coords.accuracy)}m`;
                return;
            }

            const speedKmh = speedMps * 3.6;
            speedEl.textContent = `${speedKmh.toFixed(1)} km/h`;
            statusEl.textContent = `실시간 속도 측정 중 · 정확도 ${Math.round(position.coords.accuracy)}m`;
        },
        (error) => {
            if (error.code === 1) {
                speedEl.textContent = "권한 필요";
                statusEl.textContent = "위치 권한이 거부되었습니다. 브라우저 사이트 설정에서 허용해 주십시오.";
            } else if (error.code === 2) {
                speedEl.textContent = "위치 불가";
                statusEl.textContent = "현재 위치를 가져올 수 없습니다.";
            } else if (error.code === 3) {
                speedEl.textContent = "시간 초과";
                statusEl.textContent = "위치 응답 시간이 초과되었습니다.";
            } else {
                speedEl.textContent = "오류";
                statusEl.textContent = error.message;
            }
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        }
    );
}

async function handleStartClick() {
    if (!navigator.permissions) {
        startTracking();
        return;
    }

    try {
        const result = await navigator.permissions.query({ name: "geolocation" });

        if (result.state === "granted") {
            statusEl.textContent = "이미 위치 권한이 허용되어 있습니다.";
            startTracking();
            return;
        }

        if (result.state === "prompt") {
            startTracking();
            return;
        }

        if (result.state === "denied") {
            speedEl.textContent = "권한 차단됨";
            statusEl.textContent = "브라우저 주소창의 사이트 설정에서 위치 권한을 직접 허용해야 합니다.";
            return;
        }
    } catch (err) {
        startTracking();
    }
}

startBtn.addEventListener("click", handleStartClick);