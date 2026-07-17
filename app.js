const speedEl = document.getElementById("speed");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");

let watchId = null;

// 실제 측정값이 들어오면 이 목표값을 갱신합니다.
let targetSpeedKmh = null;

// 화면에 보여줄 현재 표시값입니다.
let displaySpeedKmh = 0;

// requestAnimationFrame ID를 저장해서 중복 실행을 막습니다.
let animationId = null;

// 마지막으로 유효한 속도 측정이 들어왔는지 여부입니다.
let hasSpeed = false;

/**
 * 속도 표시를 부드럽게 목표값으로 이동시키는 애니메이션 루프입니다.
 * lerp(선형 보간) 방식으로 현재 표시값을 목표값에 점점 가깝게 만듭니다.
 */
function animateSpeed() {
    if (targetSpeedKmh == null) {
        animationId = null;
        return;
    }

    // 보간 계수입니다.
    // 값이 클수록 빨리 따라가고, 작을수록 더 부드럽지만 느려집니다.
    const smoothing = 0.12;

    // 현재 표시값을 목표값 쪽으로 이동시킵니다.
    displaySpeedKmh += (targetSpeedKmh - displaySpeedKmh) * smoothing;

    // 목표값에 거의 도달했으면 미세 떨림을 막기 위해 정확히 붙여줍니다.
    if (Math.abs(targetSpeedKmh - displaySpeedKmh) < 0.05) {
        displaySpeedKmh = targetSpeedKmh;
    }

    // 화면에는 0.1 단위로 표시합니다.
    speedEl.textContent = `${displaySpeedKmh.toFixed(1)} km/h`;

    // 아직 목표값에 완전히 도달하지 않았다면 다음 프레임도 계속 진행합니다.
    if (displaySpeedKmh !== targetSpeedKmh) {
        animationId = requestAnimationFrame(animateSpeed);
    } else {
        animationId = null;
    }
}

function startTracking() {
    if (!navigator.geolocation) {
        speedEl.textContent = "지원 안 됨";
        statusEl.textContent = "이 브라우저는 위치 API를 지원하지 않습니다.";
        return;
    }

    statusEl.textContent = "위치 권한 요청 중입니다...";

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const speedMps = position.coords.speed;

            if (speedMps == null) {
                hasSpeed = false;
                targetSpeedKmh = null;
                speedEl.textContent = "대기중";
                statusEl.textContent = `측정 대기중 입니다. 정확도: ${Math.round(position.coords.accuracy)}m`;
                return;
            }

            hasSpeed = true;

            // 실제 측정 속도를 km/h로 변환합니다.
            const speedKmh = speedMps * 3.6;

            // 목표값만 갱신하고, 실제 출력은 애니메이션 루프가 담당합니다.
            targetSpeedKmh = speedKmh;

            statusEl.textContent = `실시간 속도 측정 중 · 정확도 ${Math.round(position.coords.accuracy)}m`;

            // 애니메이션이 돌고 있지 않을 때만 새로 시작합니다.
            if (animationId == null) {
                animationId = requestAnimationFrame(animateSpeed);
            }
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