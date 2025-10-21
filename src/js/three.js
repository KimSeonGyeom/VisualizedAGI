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
    this.camera.position.set(0, 8, 10);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera);

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.canvas);

    this.clock = new T.Clock();

    this.setLights();
    this.loadStateAndSetup();
    this.render();
    this.setResize();
  }

  async loadStateAndSetup() {
    try {
      const response = await fetch('/stateschema.json');
      this.gameState = await response.json();
      this.setupGrid();
    } catch (error) {
      console.error('Failed to load state schema:', error);
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
    if (!this.gameState) return;

    const { staticInfo } = this.gameState;
    const { width, height, grid } = staticInfo;

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

  render() {
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
