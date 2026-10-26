import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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

// 4.1 Efeito de Pós-Processamento e Contorno (OutlinePass)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera
);
outlinePass.edgeStrength = 4.0;
outlinePass.edgeGlow = 0.5;
outlinePass.edgeThickness = 1.2;
outlinePass.visibleEdgeColor.set('#ffffff'); // Contorno branco ao passar o mouse
outlinePass.hiddenEdgeColor.set('#388bfd');  // Contorno azul sutil nas partes ocluídas
composer.addPass(outlinePass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

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

// 6. Variáveis de Animações e Seleção
let mixer = null;
let dogMixer = null;          // Animações do cachorro
let samuelMixer = null;       // Animações do modelo Blockbench
let samuelModel = null;       // Referência ao modelo 3D do Samuel
let selectionRing = null;     // Indicador visual de seleção
let hugoMixer = null;
let hugoModel = null;

// Controles de movimentação do Hugo
const hugoKeys = {
  w: false,
  a: false,
  s: false,
  d: false
};

const hugoSpeed = 0.08;

// Animações de parado e andando do Hugo
let hugoIdleAnimationName = null;
let hugoWalkAnimationName = null;
let hugoIsMoving = false;

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();

  if (key in hugoKeys) {
    hugoKeys[key] = true;
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();

  if (key in hugoKeys) {
    hugoKeys[key] = false;
  }
});

const hugoActions = {};
let currentHugoAction = null;
const hugoAnimationNames = [];
const samuelActions = {};     // Mapa de ações do modelo
let currentSamuelAction = null;
const clock = new THREE.Clock();

// 7. Carregamento do Mundo GLTF
const loader = new GLTFLoader();
const modelPath = './modelos/mundo/scene.gltf';

console.log('Iniciando carregamento do modelo...');

loader.load(
  modelPath,
  (gltf) => {
    console.log('Mundo carregado com sucesso:', gltf);
    const model = gltf.scene;

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
    }

    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    model.position.x -= center.x;
    model.position.y -= center.y;
    model.position.z -= center.z;

    scene.add(model);

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim > 0 ? maxDim * 1.2 : 15;

    camera.near = Math.max(0.01, distance / 100);
    camera.far = Math.max(1000, distance * 50);
    camera.updateProjectionMatrix();

    camera.position.set(distance * 0.8, distance * 0.6, distance * 0.9);
    controls.target.set(0, 0, 0);
    controls.minDistance = distance * 0.05;
    controls.maxDistance = distance * 10;
    controls.update();

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

// 8. Carregamento do Cachorro Animado
const dogPath = './modelos/mundo/cachorro/source/cachorro.glb';

console.log('Iniciando carregamento do cachorro...');

loader.load(
  dogPath,
  (gltf) => {
    const dog = gltf.scene;
    console.log('Cachorro carregado com sucesso!');

    const dogBox = new THREE.Box3().setFromObject(dog);
    const dogSize = new THREE.Vector3();
    dogBox.getSize(dogSize);

    const maxDogDim = Math.max(dogSize.x, dogSize.y, dogSize.z);
    if (maxDogDim > 0) {
      const scale = 0.85 / maxDogDim; // Reduzido de 2 para 0.85 para adequar o tamanho aos outros animais
      dog.scale.setScalar(scale);
    }

    dog.position.set(-15, 0, 20);
    scene.add(dog);

    if (gltf.animations && gltf.animations.length > 0) {
      dogMixer = new THREE.AnimationMixer(dog);
      dogMixer.clipAction(gltf.animations[0]).play();
    }
  },
  undefined,
  (error) => {
    console.error('Erro ao carregar o cachorro:', error);
  }
);

// 9. Carregamento do Modelo Blockbench (Samuel)
const samuelPath = './modelos/samuel/modelo.gltf';

console.log('Iniciando carregamento do modelo do Samuel...');

loader.load(
  samuelPath,
  (gltf) => {
    const samuel = gltf.scene;
    samuelModel = samuel;
    console.log('Modelo do Samuel carregado com sucesso!', gltf);

    // Manter as texturas nítidas estilo pixel art do Blockbench
    samuel.traverse((child) => {
      if (child.isMesh && child.material) {
        if (child.material.map) {
          child.material.map.magFilter = THREE.NearestFilter;
          child.material.map.minFilter = THREE.NearestFilter;
          child.material.map.needsUpdate = true;
        }
      }
    });

    // Dimensões e escala proporcional
    const samuelBox = new THREE.Box3().setFromObject(samuel);
    const samuelSize = new THREE.Vector3();
    samuelBox.getSize(samuelSize);

    const maxDim = Math.max(samuelSize.x, samuelSize.y, samuelSize.z);
    if (maxDim > 0) {
      const scale = 3.5 / maxDim;
      samuel.scale.setScalar(scale);
    }

    // Posiciona próximo ao cachorro
    samuel.position.set(-12, 0, 19);
    samuel.rotation.y = Math.PI * 0.2;

    // Indicador visual luminoso sob os pés quando selecionado
    const ringGeo = new THREE.RingGeometry(0.7, 0.85, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x58a6ff, side: THREE.DoubleSide });
    selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.05;
    selectionRing.visible = false;
    samuel.add(selectionRing);

    scene.add(samuel);

    // Registra as animações encontradas no GLTF
    if (gltf.animations && gltf.animations.length > 0) {
      samuelMixer = new THREE.AnimationMixer(samuel);

      gltf.animations.forEach((clip) => {
        console.log(`Animação encontrada: ${clip.name}`);
        const action = samuelMixer.clipAction(clip);

        // A animação de sentar roda apenas 1 vez e congela na pose sentado
        if (clip.name === 'sitanimation') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }

        samuelActions[clip.name] = action;
      });

      // Inicia por padrão com a animação de acenar
      if (samuelActions['waveanimation']) {
        playSamuelAnimation('waveanimation');
      } else {
        playSamuelAnimation(gltf.animations[0].name);
      }
    }
  },
  undefined,
  (error) => {
    console.error('Erro ao carregar o modelo do Samuel:', error);
  }
);

// Carregamento do personagem do Hugo
const hugoPath = './modelos/hugo/animated_humanoid_robot.glb';

console.log('Iniciando carregamento do personagem do Hugo...');

loader.load(
  hugoPath,
  (gltf) => {
    hugoModel = gltf.scene;

    console.log('Personagem do Hugo carregado com sucesso!', gltf);

    // Ajusta o tamanho do personagem
    const hugoBox = new THREE.Box3().setFromObject(hugoModel);
    const hugoSize = new THREE.Vector3();
    hugoBox.getSize(hugoSize);

    const maxHugoDim = Math.max(hugoSize.x, hugoSize.y, hugoSize.z);
    if (maxHugoDim > 0) {
      hugoModel.scale.setScalar(3.5 / maxHugoDim);
    }

    // Posiciona o personagem no mundo
    hugoModel.position.set(-8, 0, 19);
    scene.add(hugoModel);

    // Carrega as animações do personagem
    if (gltf.animations && gltf.animations.length > 0) {
      hugoMixer = new THREE.AnimationMixer(hugoModel);

      gltf.animations.forEach((clip, index) => {
        const name = clip.name || `animacao${index + 1}`;
        console.log(`Animação do Hugo: ${name}`);
        hugoActions[name] = hugoMixer.clipAction(clip);
        hugoAnimationNames.push(name);
      });

      // Identifica as animações de parado e andando
      hugoIdleAnimationName = hugoAnimationNames.find(name =>
        /idle|stand|wait|parado|standing/i.test(name)
      );

      hugoWalkAnimationName = hugoAnimationNames.find(name =>
        /walk|walking|run|running|andar|caminh/i.test(name)
      );

      // Usa alternativas caso os nomes sejam diferentes
      if (!hugoIdleAnimationName && hugoAnimationNames.length > 0) {
        hugoIdleAnimationName = hugoAnimationNames[0];
      }

      if (!hugoWalkAnimationName && hugoAnimationNames.length > 1) {
        hugoWalkAnimationName = hugoAnimationNames.find(
          name => name !== hugoIdleAnimationName
        );
      }

      console.log('Animação de parado:', hugoIdleAnimationName);
      console.log('Animação de caminhada:', hugoWalkAnimationName);

      // Inicia a animação de parado
      if (hugoIdleAnimationName) {
        playHugoAnimation(hugoIdleAnimationName);
      }
    } else {
      console.warn('O personagem do Hugo não possui animações.');
    }
  },
  undefined,
  (error) => {
    console.error('Erro ao carregar o personagem do Hugo:', error);
  }
);

// Função para trocar as animações do Hugo
function playHugoAnimation(name) {
  const targetAction = hugoActions[name];
  if (!targetAction) {
    console.warn('Animação do Hugo não encontrada:', name);
    return;
  }

  if (currentHugoAction && currentHugoAction !== targetAction) {
    currentHugoAction.fadeOut(0.2);
  }

  targetAction.reset().fadeIn(0.2).play();
  currentHugoAction = targetAction;
}

// Controla as animações de parado e andando do Hugo
function updateHugoMovementAnimation(isMoving) {
  if (hugoIsMoving === isMoving) return;

  hugoIsMoving = isMoving;

  const animationName = isMoving
    ? hugoWalkAnimationName
    : hugoIdleAnimationName;

  if (animationName) {
    playHugoAnimation(animationName);
  }
}

// Função para transicionar entre animações com fade
function playSamuelAnimation(name) {
  if (name === 'stop') {
    if (currentSamuelAction) {
      currentSamuelAction.fadeOut(0.3);
      currentSamuelAction = null;
    }
    updateActiveButton('stop');
    return;
  }

  const targetAction = samuelActions[name];
  if (!targetAction) return;
  if (targetAction === currentSamuelAction && targetAction.isRunning()) return;

  if (currentSamuelAction && currentSamuelAction !== targetAction) {
    currentSamuelAction.fadeOut(0.3);
  }

  targetAction.reset().fadeIn(0.3).play();
  currentSamuelAction = targetAction;
  updateActiveButton(name);
}

// Atualiza o botão ativo no painel
function updateActiveButton(animName) {
  const buttons = document.querySelectorAll('.anim-btn');
  buttons.forEach((btn) => {
    if (btn.dataset.anim === animName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Configuração dos botões da interface
document.querySelectorAll('.anim-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const anim = btn.dataset.anim;
    playSamuelAnimation(anim);
  });
});

// Atalhos de teclado (1: acenar, 2: andar, 3: sentar, 0/espaço: parar)
window.addEventListener('keydown', (e) => {
  if (e.key === '1') playSamuelAnimation('waveanimation');
  if (e.key === '2') playSamuelAnimation('walkanimation');
  if (e.key === '3') playSamuelAnimation('sitanimation');
  if (e.key === '0' || e.key === ' ') playSamuelAnimation('stop');

  if (e.key === '4' && hugoAnimationNames[0]) playHugoAnimation(hugoAnimationNames[0]);
  if (e.key === '5' && hugoAnimationNames[1]) playHugoAnimation(hugoAnimationNames[1]);
  if (e.key === '6' && hugoAnimationNames[2]) playHugoAnimation(hugoAnimationNames[2]);
});

// Sistema de Seleção do Personagem via Clique e Raycaster
const animPanel = document.getElementById('anim-panel');
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0 };

function selectSamuel() {
  if (animPanel) animPanel.classList.add('visible');
  if (selectionRing) selectionRing.visible = true;
}

function deselectSamuel() {
  if (animPanel) animPanel.classList.remove('visible');
  if (selectionRing) selectionRing.visible = false;
}

window.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointerup', (e) => {
  // Se o clique foi no painel de botões, mantém a seleção
  if (animPanel && animPanel.contains(e.target)) return;

  // Ignora se foi arrasto da câmera (OrbitControls)
  const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > 6) return;

  if (!samuelModel) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(samuelModel, true);

  // Se clicou no personagem, seleciona; se clicou fora, desfaz seleção
  if (intersects.length > 0) {
    selectSamuel();
  } else {
    deselectSamuel();
  }
});

// Cursor estilo 'pointer' e contorno visual ao passar o mouse sobre o personagem
window.addEventListener('pointermove', (e) => {
  if (!samuelModel) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(samuelModel, true);

  if (intersects.length > 0) {
    renderer.domElement.style.cursor = 'pointer';
    outlinePass.selectedObjects = [samuelModel];
  } else {
    renderer.domElement.style.cursor = 'default';
    outlinePass.selectedObjects = [];
  }
});

// 10. Redimensionamento Responsivo
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  composer.setSize(width, height);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  outlinePass.resolution.set(width, height);
});

// 11. Loop de Renderização
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  if (dogMixer) {
    dogMixer.update(delta);
  }

  if (samuelMixer) {
    samuelMixer.update(delta);
  }

  if (hugoMixer) {
    hugoMixer.update(delta);
  }

  // Movimentação do personagem do Hugo
  if (hugoModel) {
    let moveX = 0;
    let moveZ = 0;

    if (hugoKeys.w) moveZ -= 1;
    if (hugoKeys.s) moveZ += 1;
    if (hugoKeys.a) moveX -= 1;
    if (hugoKeys.d) moveX += 1;

    const isMoving = moveX !== 0 || moveZ !== 0;

    // Alterna entre parado e andando
    updateHugoMovementAnimation(isMoving);

    if (isMoving) {
      // Evita andar mais rápido na diagonal
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;

      // Move o personagem
      const movementScale = delta * 60;
      hugoModel.position.x += moveX * hugoSpeed * movementScale;
      hugoModel.position.z += moveZ * hugoSpeed * movementScale;

      // Calcula a direção para a qual o personagem deve olhar
      const targetRotation = Math.atan2(moveX, moveZ);

      // Gira suavemente na direção do movimento
      let angleDifference = targetRotation - hugoModel.rotation.y;

      angleDifference = Math.atan2(
        Math.sin(angleDifference),
        Math.cos(angleDifference)
      );

      hugoModel.rotation.y += angleDifference * Math.min(1, delta * 8);
    }
  }

  controls.update();
  composer.render();
}

animate();