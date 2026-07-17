const overlayEl = document.getElementById("overlay");
const dashboardEl = document.getElementById("dashboard");
const speedEl = document.getElementById("speed");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const needleEl = document.getElementById("needle");
const mapEl = document.querySelector(".map");

// 위치 추적 속도와 애니메이션 관련 변수
let watchId = null;
let targetSpeedKmh = null;
let displaySpeedKmh = 0;
let animationId = null;
let hasSpeed = false;

// 지도 관련 변수
let map = null;
let targetZoom = 17;
let zoomAnimationId = null;
let marker = null;
let accuracyCircle = null;
let mapInitialized = false;

//------ 위치 추적 속도 애니메이션 함수 ------
function animateSpeed() {
    if (targetSpeedKmh == null) {
        animationId = null;
        return;
    }

    const smoothing = 0.12;

    displaySpeedKmh += (targetSpeedKmh - displaySpeedKmh) * smoothing;

    if (Math.abs(targetSpeedKmh - displaySpeedKmh) < 0.05) {
        displaySpeedKmh = targetSpeedKmh;
    }

    speedEl.textContent = `${displaySpeedKmh.toFixed(1)}`;
    updateGauge(displaySpeedKmh);

    if (displaySpeedKmh !== targetSpeedKmh) {
        animationId = requestAnimationFrame(animateSpeed);
    } else {
        animationId = null;
    }
}
//------ 위치 추적 속도 애니메이션 함수 ------

//------ 지도 관련 함수 ------
function initMap(lat, lng) {
    map = L.map(mapEl, {
        zoomControl: true,
        maxZoom: 20,
        minZoom: 17
    }).setView([lat, lng], 17);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        className: "map-tiles-hud"
    }).addTo(map);

    marker = L.marker([lat, lng]).addTo(map);
    accuracyCircle = L.circle([lat, lng], {
        radius: 0,
        color: "#00000000",
        fillColor: "#00000000",
        fillOpacity: 0.0,
        weight: 1
    }).addTo(map);

    mapInitialized = true;
}

function updateMap(lat, lng, accuracy, speedKmh = null) {
    if (!mapInitialized) {
        initMap(lat, lng);
    }

    marker.setLatLng([lat, lng]);
    accuracyCircle.setLatLng([lat, lng]);
    accuracyCircle.setRadius(accuracy);

    // 속도값이 있으면 목표 줌을 다시 계산합니다.
    if (speedKmh != null) {
        targetZoom = getTargetZoomBySpeed(speedKmh);
    }

    // 줌 애니메이션이 없으면 시작합니다.
    if (zoomAnimationId == null) {
        zoomAnimationId = requestAnimationFrame(() => animateMapZoom(lat, lng));
    } else {
        // 이미 돌고 있으면 중심만 최신 좌표로 즉시 반영
        map.panTo([lat, lng], { animate: false });
    }
}

function getTargetZoomBySpeed(speedKmh) {
    if (speedKmh < 5) {
        return 17;
    }

    if (speedKmh < 30) {
        // 5 ~ 30 km/h 구간에서 17 -> 18
        const t = (speedKmh - 5) / (30 - 5);
        return 17 + t * 1;
    }

    if (speedKmh < 60) {
        // 30 ~ 60 km/h 구간에서 18 -> 20
        const t = (speedKmh - 30) / (60 - 30);
        return 18 + t * 2;
    }

    return 20;
}

function animateMapZoom(lat, lng) {
    if (!map) {
        zoomAnimationId = null;
        return;
    }

    const currentZoom = map.getZoom();
    const nextZoom = currentZoom + (targetZoom - currentZoom) * 0.12;

    // 거의 도달했으면 목표값에 붙입니다.
    const finalZoom = Math.abs(targetZoom - nextZoom) < 0.02 ? targetZoom : nextZoom;

    // 중심도 같이 유지하면서 줌을 갱신합니다.
    map.setView([lat, lng], finalZoom, {
        animate: false
    });

    if (finalZoom !== targetZoom) {
        zoomAnimationId = requestAnimationFrame(() => animateMapZoom(lat, lng));
    } else {
        zoomAnimationId = null;
    }
}
//------ 지도 관련 함수 ------

//------ 위치 추적 시작 함수 ------
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
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            const speedKmh = speedMps * 3.6;

            updateMap(lat, lng, accuracy, speedKmh);

            if (speedMps == null) {
                hasSpeed = false;
                targetSpeedKmh = 0.0;
                statusEl.textContent = `측정 대기중 입니다. 정확도: ${Math.round(position.coords.accuracy)}m`;

                if (animationId == null) {
                    animationId = requestAnimationFrame(animateSpeed);
                }
                return;
            }

            hasSpeed = true;
            targetSpeedKmh = speedKmh;

            statusEl.textContent = `실시간 속도 측정 중 · 정확도 ${Math.round(position.coords.accuracy)}m`;

            if (animationId == null) {
                animationId = requestAnimationFrame(animateSpeed);
            }
        },
        (error) => {
            if (error.code === 1) {
                speedEl.textContent = "권한 필요";
                statusEl.textContent = "위치 권한이 거부되었습니다.";
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
//------ 위치 추적 시작 함수 ------

//------ 속도계 바늘 회전 업데이트 함수 ------
function updateGauge(speedKmh) {
    // 0 ~ 200 범위로 제한
    const clamped = Math.max(0, Math.min(200, speedKmh));

    // 0km/h = -120도, 200km/h = 120도
    const angle = -120 + (clamped / 200) * 240;

    needleEl.style.transform =
        `translateX(-50%) translateY(-100%) rotate(${angle}deg)`;
}
//------ 속도계 바늘 회전 업데이트 함수 ------

//------ 시작 버튼 클릭 이벤트 핸들러 ------
async function handleStartClick() {
    if (!navigator.permissions) {
        startTracking();
        return;
    }

    try {
        const result = await navigator.permissions.query({ name: "geolocation" });

        if (result.state === "granted") {
            statusEl.textContent = "이미 위치 권한이 허용되어 있습니다.";
            overlayEl.style.display = "none";
            dashboardEl.style.display = "flex";
            startTracking();
            return;
        }

        if (result.state === "prompt") {
            overlayEl.style.display = "none";
            dashboardEl.style.display = "flex";
            startTracking();
            return;
        }

        if (result.state === "denied") {
            ;
            speedEl.textContent = "권한 차단됨";
            statusEl.textContent = "브라우저 주소창의 사이트 설정에서 위치 권한을 직접 허용해야 합니다.";
            return;
        }
    } catch (err) {
        startTracking();
    }
}
//------ 시작 버튼 클릭 이벤트 핸들러 ------

startBtn.addEventListener("click", handleStartClick);