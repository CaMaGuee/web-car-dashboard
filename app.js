const speedKmhEl = document.getElementById("speedKmh");
const statusTextEl = document.getElementById("statusText");
const accuracyTextEl = document.getElementById("accuracyText");
const rawSpeedTextEl = document.getElementById("rawSpeedText");
const filteredSpeedTextEl = document.getElementById("filteredSpeedText");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");

const state = {
  watchId: null,
  lastAcceptedPosition: null,
  lastFilteredSpeedMps: 0,
  lastDisplaySpeedMps: 0,
  lastUpdateAt: 0
};

function mpsToKmh(mps) {
  return mps * 3.6;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const x =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function setStatus(message) {
  statusTextEl.textContent = message;
}

function renderSpeed(rawMps, filteredMps, accuracy) {
  speedKmhEl.textContent = mpsToKmh(filteredMps).toFixed(1);
  rawSpeedTextEl.textContent =
    rawMps == null ? "-" : `${mpsToKmh(rawMps).toFixed(1)} km/h`;
  filteredSpeedTextEl.textContent = `${mpsToKmh(filteredMps).toFixed(1)} km/h`;
  accuracyTextEl.textContent =
    accuracy == null ? "-" : `${Math.round(accuracy)} m`;
}

/*
  속도 계산 설계 원칙
  1) coords.speed가 정상 범위면 우선 사용
  2) 없거나 이상하면 좌표 변화로 계산
  3) accuracy가 너무 크면 샘플 버림
  4) 정지 상태 오탐 방지를 위해 이동 거리 <= 정확도 기반 임계값이면 0 처리
  5) 급격한 점프 값은 무시
  6) 마지막에 EMA 평활화
*/
function computeSpeed(position) {
  const coords = position.coords;

  const current = {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy ?? 9999,
    speed: coords.speed,
    timestamp: position.timestamp
  };

  let rawSpeedMps = null;

  // 정확도 너무 나쁜 샘플은 사용하지 않음
  // 정확도 30m 초과면 정지 상태에서 오탐 확률이 크게 올라갑니다.
  if (current.accuracy > 30) {
    return {
      rawSpeedMps: null,
      filteredSpeedMps: state.lastFilteredSpeedMps * 0.85,
      accepted: false
    };
  }

  // 브라우저가 직접 제공한 speed를 우선 사용
  // null일 수 있으므로 검증 후 사용합니다.
  if (
    current.speed != null &&
    !Number.isNaN(current.speed) &&
    current.speed >= 0 &&
    current.speed <= 60
  ) {
    rawSpeedMps = current.speed;
  } else {
    if (!state.lastAcceptedPosition) {
      state.lastAcceptedPosition = current;
      return {
        rawSpeedMps: null,
        filteredSpeedMps: 0,
        accepted: true
      };
    }

    const prev = state.lastAcceptedPosition;
    const dt = (current.timestamp - prev.timestamp) / 1000;

    // 시간 간격이 너무 짧으면 GPS 노이즈를 속도로 착각하기 쉽습니다.
    if (dt < 0.9) {
      return {
        rawSpeedMps: null,
        filteredSpeedMps: state.lastFilteredSpeedMps,
        accepted: false
      };
    }

    const distance = haversineMeters(
      { lat: prev.lat, lng: prev.lng },
      { lat: current.lat, lng: current.lng }
    );

    // 정지 판정 핵심
    // 이동 거리보다 위치 오차 범위가 크면 실제 이동으로 보지 않습니다.
    const stationaryThreshold = Math.max(
      6,
      Math.min(18, (prev.accuracy + current.accuracy) * 0.45)
    );

    if (distance <= stationaryThreshold) {
      rawSpeedMps = 0;
    } else {
      rawSpeedMps = distance / dt;
    }
  }

  // 비정상 급점프 제거
  // 갑자기 0 -> 105 km/h 같은 값이 뜨는 것을 막는 핵심 단계입니다.
  const maxJumpMps = 8; // 약 28.8 km/h
  if (Math.abs(rawSpeedMps - state.lastFilteredSpeedMps) > maxJumpMps) {
    rawSpeedMps = state.lastFilteredSpeedMps;
  }

  // 저속 흔들림 제거
  if (rawSpeedMps < 0.8) {
    rawSpeedMps = 0;
  }

  // 반응성을 살리기 위해 가속 시 alpha를 더 크게,
  // 감속 시 alpha를 더 작게 해서 숫자가 빨리 올라가고 부드럽게 내려가게 함
  const alphaUp = 0.55;
  const alphaDown = 0.35;
  const alpha =
    rawSpeedMps >= state.lastFilteredSpeedMps ? alphaUp : alphaDown;

  let filteredSpeedMps =
    state.lastFilteredSpeedMps * (1 - alpha) + rawSpeedMps * alpha;

  // 거의 0이면 완전히 0으로 고정
  if (filteredSpeedMps < 0.5) {
    filteredSpeedMps = 0;
  }

  state.lastAcceptedPosition = current;
  state.lastFilteredSpeedMps = filteredSpeedMps;
  state.lastUpdateAt = current.timestamp;

  return {
    rawSpeedMps,
    filteredSpeedMps,
    accepted: true
  };
}

function handlePosition(position) {
  const result = computeSpeed(position);

  renderSpeed(
    result.rawSpeedMps,
    result.filteredSpeedMps,
    position.coords.accuracy
  );

  if (result.accepted) {
    setStatus("속도를 측정 중입니다. 정지 상태에서는 0 km/h 유지에 우선순위를 둡니다.");
  } else {
    setStatus("정확도가 낮거나 샘플 간격이 짧아 이전 안정값을 유지합니다.");
  }
}

function handleError(error) {
  const messageMap = {
    1: "위치 권한이 거부되었습니다. 브라우저에서 위치 권한을 허용해야 합니다.",
    2: "현재 위치를 가져올 수 없습니다. GPS 또는 네트워크 상태를 확인해 주십시오.",
    3: "위치 응답 시간이 초과되었습니다. 실외에서 다시 시도해 보십시오."
  };

  setStatus(messageMap[error.code] || `위치 오류: ${error.message}`);
}

function startTracking() {
  if (!("geolocation" in navigator)) {
    setStatus("이 브라우저는 Geolocation API를 지원하지 않습니다.");
    return;
  }

  if (state.watchId !== null) {
    setStatus("이미 측정 중입니다.");
    return;
  }

  setStatus("GPS 속도 측정을 시작합니다. 위치 권한을 허용해 주십시오.");

  state.watchId = navigator.geolocation.watchPosition(
    handlePosition,
    handleError,
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 4000
    }
  );
}

function stopTracking() {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
    setStatus("측정을 중지했습니다.");
  }
}

startButton.addEventListener("click", startTracking);
stopButton.addEventListener("click", stopTracking);
renderSpeed(null, 0, null);