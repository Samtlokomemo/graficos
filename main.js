import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Elementos da página
const canvas = document.querySelector('#canvas3d');
const loadingElement = document.querySelector('#loading');

// 1. Cena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c23);

// 2. Câmera
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  10000
);
camera.position.set(0, 10, 25);

// 3. Renderizador
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// 4. Controles da Câmera (OrbitControls)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.enableRotate = true;

// 5. Iluminação
const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 1.2);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight1.position.set(20, 40, 20);
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight2.position.set(-20, 20, -20);
scene.add(dirLight2);

// 6. Mixer para animações caso existam
let mixer = null;
const clock = new THREE.Clock();

// 7. Carregamento do Modelo GLTF
const loader = new GLTFLoader();
const modelPath = './modelos/mundo/scene.gltf';

console.log('Iniciando carregamento do modelo...');

loader.load(
  modelPath,
  (gltf) => {
    console.log('Modelo carregado com sucesso:', gltf);
    const model = gltf.scene;

    // Se o modelo tiver animações, inicia a reprodução
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
    }

    // Calcula a caixa delimitadora real do modelo
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    console.log('Dimensões originais do modelo:', size);
    console.log('Centro original do modelo:', center);

    // Centraliza o modelo geometricamente na origem
    model.position.x -= center.x;
    model.position.y -= center.y;
    model.position.z -= center.z;

    scene.add(model);

    // Ajusta a câmera e os limites do OrbitControls com base no tamanho do objeto
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim > 0 ? maxDim * 2.2 : 15;

    camera.near = Math.max(0.01, distance / 100);
    camera.far = Math.max(1000, distance * 50);
    camera.updateProjectionMatrix();

    camera.position.set(distance * 0.8, distance * 0.6, distance * 0.9);
    controls.target.set(0, 0, 0);
    controls.minDistance = distance * 0.05;
    controls.maxDistance = distance * 10;
    controls.update();

    // Remove elemento de loading
    if (loadingElement) {
      loadingElement.style.opacity = '0';
      setTimeout(() => loadingElement.remove(), 400);
    }
  },
  (xhr) => {
    if (loadingElement && xhr.total > 0) {
      const percent = Math.round((xhr.loaded / xhr.total) * 100);
      loadingElement.textContent = `Carregando mundo 3D... ${percent}%`;
    }
  },
  (error) => {
    console.error('Erro ao carregar o modelo GLTF:', error);
    if (loadingElement) {
      loadingElement.textContent = 'Erro ao carregar o modelo 3D. Verifique o console.';
      loadingElement.style.background = 'rgba(180, 0, 0, 0.7)';
    }
  }
);

// 8. Redimensionamento Responsivo
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// 9. Loop de Renderização
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) {
    mixer.update(delta);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
