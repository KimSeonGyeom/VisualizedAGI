import * as T from 'three';
// eslint-disable-next-line import/no-unresolved
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const device = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: window.devicePixelRatio
};

export default class Three {
  constructor(canvas) {
    this.canvas = canvas;

    this.scene = new T.Scene();

    this.camera = new T.PerspectiveCamera(
      75,
      device.width / device.height,
      0.1,
      100
    );
    this.camera.position.set(3, 8, 10);
    this.camera.lookAt(3, 0, 2.5);
    this.scene.add(this.camera);

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
    this.renderer.setClearColor(0xffffff, 1); // 하얀 배경

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(3, 0, 2.5);
    this.controls.update();

    this.clock = new T.Clock();

    // 재생 관련 변수
    this.currentFrameIndex = 0;
    this.frameRate = 2; 
    this.isPlaying = true;
    this.lastFrameTime = 0;
    this.frames = null;
    this.dynamicObjects = new Map();

    // Progress bar 엘리먼트
    this.progressBar = document.getElementById('progress-bar');
    this.currentTimestepEl = document.getElementById('current-timestep');
    this.currentScoreEl = document.getElementById('current-score');
    this.currentFrameEl = document.getElementById('current-frame');
    this.totalFramesEl = document.getElementById('total-frames');

    this.setLights();
    this.loadReplayAndSetup();
    this.render();
    this.setResize();
  }

  async loadReplayAndSetup() {
    try {
      const response = await fetch('/replay.json');
      const replayData = await response.json();
      
      this.staticInfo = replayData.staticInfo;
      this.frames = replayData.frames;
      this.totalFrames = this.frames.length;
      
      console.log(`Loaded replay with ${this.totalFrames} frames`);
      
      // Update total frames display
      if (this.totalFramesEl) {
        this.totalFramesEl.textContent = this.totalFrames;
      }
      
      this.setupGrid();
      this.setupDynamicObjects();
      this.updateFrame(0);
    } catch (error) {
      console.error('Failed to load replay:', error);
    }
  }

  setLights() {
    this.ambientLight = new T.AmbientLight(new T.Color(1, 1, 1), 0.6);
    this.scene.add(this.ambientLight);

    this.directionalLight = new T.DirectionalLight(new T.Color(1, 1, 1), 0.8);
    this.directionalLight.position.set(5, 10, 5);
    this.scene.add(this.directionalLight);
  }

  setupGrid() {
    if (!this.staticInfo) return;

    const { width, height, grid } = this.staticInfo;

    // 격자 생성 (GridHelper)
    const gridHelper = new T.GridHelper(
      Math.max(width, height),
      Math.max(width, height),
      0x444444,
      0x222222
    );
    gridHelper.position.set((width - 1) / 2, 0, (height - 1) / 2);
    this.scene.add(gridHelper);

    // 바닥 평면 추가
    const floorGeometry = new T.PlaneGeometry(width, height);
    const floorMaterial = new T.MeshStandardMaterial({
      color: 0x1a1a1a,
      side: T.DoubleSide
    });
    const floor = new T.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((width - 1) / 2, -0.01, (height - 1) / 2);
    this.scene.add(floor);

    // Grid 배열을 순회하며 객체 생성
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellType = grid[y][x];
        this.createCell(cellType, x, y);
      }
    }
  }

  createCell(cellType, x, z) {
    if (cellType === ' ') return; // 빈 공간은 아무것도 그리지 않음

    const geometry = new T.BoxGeometry(0.8, 0.8, 0.8);
    let color, label;

    switch (cellType) {
      case 'X': // 카운터
        color = 0x8b4513;
        label = 'Counter';
        break;
      case 'P': // 냄비
        color = 0xff4444;
        label = 'Pot';
        break;
      case 'O': // 양파통
        color = 0xffaa00;
        label = 'Onion Dispenser';
        break;
      case 'D': // 접시통
        color = 0x4444ff;
        label = 'Dish Dispenser';
        break;
      case 'S': // 서빙대
        color = 0x44ff44;
        label = 'Serving Station';
        break;
      default:
        color = 0x888888;
        label = 'Unknown';
    }

    const material = new T.MeshStandardMaterial({ color });
    const cube = new T.Mesh(geometry, material);
    cube.position.set(x, 0.4, z);
    cube.userData = { type: cellType, label, x, z };
    this.scene.add(cube);
  }

  setupDynamicObjects() {
    if (!this.frames || this.frames.length === 0) return;

    const firstFrame = this.frames[0];

    // 플레이어 메시 생성 (방향을 나타내는 형태)
    firstFrame.players.forEach(player => {
      // 플레이어 그룹 생성
      const playerGroup = new T.Group();
      
      // 몸통 (실린더)
      const bodyGeometry = new T.CylinderGeometry(0.25, 0.25, 0.6, 16);
      const bodyMaterial = new T.MeshStandardMaterial({ 
        color: player.id === 0 ? 0x00ff00 : 0x0000ff 
      });
      const body = new T.Mesh(bodyGeometry, bodyMaterial);
      playerGroup.add(body);
      
      // 머리 (구)
      const headGeometry = new T.SphereGeometry(0.2, 16, 16);
      const headMaterial = new T.MeshStandardMaterial({ 
        color: player.id === 0 ? 0x00cc00 : 0x0000cc 
      });
      const head = new T.Mesh(headGeometry, headMaterial);
      head.position.y = 0.4;
      playerGroup.add(head);
      
      // 방향 표시 (원뿔 - 앞쪽을 가리킴)
      const coneGeometry = new T.ConeGeometry(0.15, 0.4, 8);
      const coneMaterial = new T.MeshStandardMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.3
      });
      const cone = new T.Mesh(coneGeometry, coneMaterial);
      cone.position.set(0, 0.2, 0.35); // 앞쪽으로 배치
      cone.rotation.x = Math.PI / 2; // 앞을 향하도록 회전
      playerGroup.add(cone);
      
      // 눈 추가 (더 명확한 방향 표시)
      const eyeGeometry = new T.SphereGeometry(0.05, 8, 8);
      const eyeMaterial = new T.MeshStandardMaterial({ color: 0x000000 });
      
      const leftEye = new T.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.08, 0.45, 0.15);
      playerGroup.add(leftEye);
      
      const rightEye = new T.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.08, 0.45, 0.15);
      playerGroup.add(rightEye);
      
      playerGroup.userData = {
        targetPosition: { x: player.position.x, z: player.position.y },
        currentPosition: { x: player.position.x, z: player.position.y },
        targetRotation: 0,
        currentRotation: 0,
        type: 'player',
        bodyMaterial: bodyMaterial
      };
      
      this.scene.add(playerGroup);
      this.dynamicObjects.set(`player_${player.id}`, playerGroup);
    });

    console.log(`Created ${this.dynamicObjects.size} dynamic objects`);
  }

  updateFrame(frameIndex) {
    if (!this.frames || frameIndex >= this.totalFrames) return;

    const frame = this.frames[frameIndex];
    this.currentFrameIndex = frameIndex;

    // Progress bar 업데이트
    const progress = (frameIndex / (this.totalFrames - 1)) * 100;
    if (this.progressBar) {
      this.progressBar.style.width = `${progress}%`;
    }
    if (this.currentTimestepEl) {
      this.currentTimestepEl.textContent = frame.timestep;
    }
    if (this.currentScoreEl) {
      this.currentScoreEl.textContent = frame.score;
    }
    if (this.currentFrameEl) {
      this.currentFrameEl.textContent = frameIndex + 1;
    }

    // 플레이어 위치 및 방향 업데이트
    frame.players.forEach(player => {
      const mesh = this.dynamicObjects.get(`player_${player.id}`);
      if (mesh) {
        // 목표 위치 설정 (JSON의 y는 Three.js의 z축)
        mesh.userData.targetPosition = {
          x: player.position.x,
          z: player.position.y
        };

        // 방향(orientation)에 따른 회전
        const rotations = {
          'north': 0,
          'east': Math.PI / 2,
          'south': Math.PI,
          'west': -Math.PI / 2
        };
        mesh.userData.targetRotation = rotations[player.orientation] || 0;

        // 들고 있는 오브젝트 표시 (간단하게 색상 변경)
        if (player.heldObject && mesh.userData.bodyMaterial) {
          mesh.userData.bodyMaterial.emissive = new T.Color(0x333333);
        } else if (mesh.userData.bodyMaterial) {
          mesh.userData.bodyMaterial.emissive = new T.Color(0x000000);
        }
      }
    });

    // 맵 위의 오브젝트들 업데이트
    this.updateMapObjects(frame.objects);
  }

  updateMapObjects(objects) {
    // 기존 맵 오브젝트 제거 (플레이어 제외)
    const toRemove = [];
    this.dynamicObjects.forEach((mesh, key) => {
      if (key.startsWith('object_')) {
        toRemove.push(key);
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    });
    toRemove.forEach(key => this.dynamicObjects.delete(key));

    // 새로운 오브젝트 생성
    objects.forEach((obj, index) => {
      let geometry, material;

      if (obj.name === 'soup') {
        // 냄비 위의 스프
        geometry = new T.CylinderGeometry(0.3, 0.3, 0.4, 16);
        
        let color = 0xffa500; // 기본 주황색
        if (obj.isReady) {
          color = 0xff0000; // 완성되면 빨간색
        } else if (obj.isCooking) {
          color = 0xffaa00; // 조리 중이면 밝은 주황색
        }
        
        material = new T.MeshStandardMaterial({ color });
      } else if (obj.name === 'dish') {
        // 접시
        geometry = new T.CylinderGeometry(0.25, 0.25, 0.1, 16);
        material = new T.MeshStandardMaterial({ color: 0xffffff });
      } else if (obj.name === 'onion') {
        // 양파
        geometry = new T.SphereGeometry(0.2, 16, 16);
        material = new T.MeshStandardMaterial({ color: 0xffaa00 });
      } else {
        // 기타
        geometry = new T.BoxGeometry(0.3, 0.3, 0.3);
        material = new T.MeshStandardMaterial({ color: 0x888888 });
      }

      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(obj.position.x, 1.2, obj.position.y);
      mesh.userData = {
        targetPosition: { x: obj.position.x, z: obj.position.y },
        currentPosition: { x: obj.position.x, z: obj.position.y },
        type: 'object'
      };

      this.scene.add(mesh);
      this.dynamicObjects.set(`object_${index}`, mesh);
    });
  }

  render() {
    const deltaTime = this.clock.getDelta();

    // 프레임 기반 재생
    if (this.isPlaying && this.frames) {
      this.frameTimer = (this.frameTimer || 0) + deltaTime;
      const expectedFrameTime = 1 / this.frameRate;
      
      if (this.frameTimer >= expectedFrameTime) {
        this.currentFrameIndex++;
        if (this.currentFrameIndex >= this.totalFrames) {
          this.currentFrameIndex = 0; // 루프
        }
        this.updateFrame(this.currentFrameIndex);
        this.frameTimer = 0;
      }
    }

    // 부드러운 보간 애니메이션
    const lerpSpeed = 8.0;
    this.dynamicObjects.forEach((mesh, key) => {
      const { targetPosition, currentPosition, targetRotation, currentRotation } = mesh.userData;
      
      if (targetPosition && currentPosition) {
        // 위치 보간
        currentPosition.x += (targetPosition.x - currentPosition.x) * lerpSpeed * deltaTime;
        currentPosition.z += (targetPosition.z - currentPosition.z) * lerpSpeed * deltaTime;
        
        mesh.position.x = currentPosition.x;
        mesh.position.z = currentPosition.z;
        mesh.position.y = mesh.userData.type === 'player' ? 0.8 : 1.2;
      }

      // 회전 보간 (플레이어만)
      if (targetRotation !== undefined && currentRotation !== undefined) {
        // 각도 차이 계산 (-PI ~ PI 범위로 정규화)
        let diff = targetRotation - currentRotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        mesh.userData.currentRotation += diff * lerpSpeed * deltaTime;
        mesh.rotation.y = mesh.userData.currentRotation;
      }
    });

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    device.width = window.innerWidth;
    device.height = window.innerHeight;

    this.camera.aspect = device.width / device.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
  }
}
