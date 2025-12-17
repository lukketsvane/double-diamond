import React, { useRef, useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Hand, 
  Eye, 
  Copy,
  Check,
  Shuffle,
  RefreshCcw,
  Download,
  Pencil,
  Sparkles,
  X,
  Trash2
} from "lucide-react";

// --- Types ---
type PoseData = Record<string, {x: number, y: number, z: number}>;
type ThemeMode = 'light' | 'dark';

// --- Constants ---
const INITIAL_POSE: PoseData = {
  "limb_0_joint_1": { "x": -0.102, "y": 0.062, "z": 1.451 },
  "limb_0_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_1_joint_1": { "x": -0.001, "y": -0.062, "z": 1.421 },
  "limb_1_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_2_joint_1": { "x": -0.109, "y": -0.05, "z": 1.444 },
  "limb_2_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_3_joint_1": { "x": 0.077, "y": 0.365, "z": 1.376 },
  "limb_3_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_4_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_4_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_5_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_5_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_6_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_6_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_7_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_7_joint_2": { "x": 0, "y": 0, "z": 1.57 }
};

// Generate labels for every segment of every limb
// Limbs 0-3 (Top): Inner(J1)=Define, Outer(J2)=Discover
// Limbs 4-7 (Bottom): Inner(J1)=Develop, Outer(J2)=Deploy
const generateLabels = () => {
    const labels = [];
    // Top Limbs
    for(let i=0; i<4; i++) {
        labels.push({ text: "define", limbIndex: i, jointIndex: 1 });
        labels.push({ text: "discover", limbIndex: i, jointIndex: 2 });
    }
    // Bottom Limbs
    for(let i=4; i<8; i++) {
        labels.push({ text: "develop", limbIndex: i, jointIndex: 1 });
        labels.push({ text: "deploy", limbIndex: i, jointIndex: 2 });
    }
    return labels;
};
const INDIVIDUAL_LABELS = generateLabels();

const COLORS = {
  light: {
    bg: 0xf2f2f7,
    fog: 0xf2f2f7,
    limb: 0x1c1c1e,
    joint: 0x000000,
    edge: 0xaeaeb2,
    ambient: 0xffffff,
    directional: 0xffffff,
    back: 0x8e8e93
  },
  dark: {
    bg: 0x000000,
    fog: 0x000000,
    limb: 0xf2f2f7,
    joint: 0x2c2c2e,
    edge: 0x636366,
    ambient: 0x404040,
    directional: 0xffffff,
    back: 0x0a84ff
  }
};

const CACHE_KEY = "mento_pose_cache";

// --- Helper: Wobbly Geometry ---
const createWobblyGeometry = (baseGeo: THREE.BufferGeometry, magnitude: number = 0.015) => {
  const geo = baseGeo.clone();
  const posAttribute = geo.attributes.position;
  const count = posAttribute.count;
  
  for (let i = 0; i < count; i++) {
    const dx = (Math.random() - 0.5) * magnitude;
    const dy = (Math.random() - 0.5) * magnitude;
    const dz = (Math.random() - 0.5) * magnitude;
    
    posAttribute.setX(i, posAttribute.getX(i) + dx);
    posAttribute.setY(i, posAttribute.getY(i) + dy);
    posAttribute.setZ(i, posAttribute.getZ(i) + dz);
  }
  
  geo.computeVertexNormals();
  return geo;
};

// --- Helper: Strip Markdown ---
const stripMarkdown = (text: string) => {
    let clean = text.trim();
    if (clean.startsWith("```json")) clean = clean.substring(7);
    if (clean.startsWith("```")) clean = clean.substring(3);
    if (clean.endsWith("```")) clean = clean.substring(0, clean.length - 3);
    return clean.trim();
};

const useSystemTheme = (): ThemeMode => {
  const getTheme = () => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState<ThemeMode>(getTheme);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return theme;
};

const App = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const theme = useSystemTheme();
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [grabEnabled, setGrabEnabled] = useState(true);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const creatureRef = useRef<THREE.Group | null>(null);
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  
  const isDraggingRef = useRef(false);
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragStartPointRef = useRef(new THREE.Vector3());
  const dragStartVectorRef = useRef(new THREE.Vector3());
  const jointWorldPosRef = useRef(new THREE.Vector3());
  const previousPointerRef = useRef({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);

  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const limbMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const highlightMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const jointMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  
  const invisibleMaterialRef = useRef<THREE.MeshBasicMaterial>(new THREE.MeshBasicMaterial({ 
      transparent: true, 
      opacity: 0,
      depthWrite: false 
  }));

  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    directional: THREE.DirectionalLight;
    back: THREE.DirectionalLight;
  } | null>(null);

  // --- 3D Initialization ---
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03); 
    sceneRef.current = scene;

    // ORTHOGRAPHIC CAMERA SETUP
    const frustumSize = 12;
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        1000
    );
    // CRITICAL FIX: Camera must be close enough (z=20) so fog doesn't obscure everything
    camera.position.set(0, 0, 20);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: false,
        preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 20);
    scene.add(dirLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 1);
    backLight.position.set(-5, -5, -20);
    scene.add(backLight);

    lightsRef.current = { ambient: ambientLight, directional: dirLight, back: backLight };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enabled = true;
    controlsRef.current = controls;

    const creatureGroup = new THREE.Group();
    creatureRef.current = creatureGroup;
    scene.add(creatureGroup);

    limbMaterialRef.current.roughness = 0.5;
    limbMaterialRef.current.metalness = 0.5;
    highlightMaterialRef.current.roughness = 0.5;
    highlightMaterialRef.current.metalness = 0.5;
    jointMaterialRef.current.roughness = 0.1;
    jointMaterialRef.current.metalness = 0.9;

    const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
    
    const createLimb = (isUpper: boolean, angle: number, index: number) => {
        const pivotGroup = new THREE.Group();
        pivotGroup.rotation.y = angle;
        const verticalAngle = isUpper ? Math.PI / 4 : -Math.PI / 4;
        pivotGroup.rotation.z = verticalAngle;
        creatureGroup.add(pivotGroup);

        const seg1Length = 1.5;
        // Increased thickness for better visibility
        const thickness = 0.08; 
        
        const seg1BaseGeo = new THREE.BoxGeometry(thickness, seg1Length, thickness, 3, 12, 3);
        const seg1Geo = createWobblyGeometry(seg1BaseGeo, 0.02);
        const seg1 = new THREE.Mesh(seg1Geo, limbMaterialRef.current);
        seg1.position.y = seg1Length / 2;
        seg1.name = "visual";
        
        const seg1HitboxGeo = new THREE.BoxGeometry(0.3, seg1Length, 0.3);
        const seg1Hitbox = new THREE.Mesh(seg1HitboxGeo, invisibleMaterialRef.current);
        seg1Hitbox.position.y = seg1Length / 2;
        seg1Hitbox.userData = { isPart: true, isHitbox: true, limbIndex: index, segmentIndex: 1 };
        seg1Hitbox.name = "hitbox";

        const seg1Wrapper = new THREE.Group();
        seg1Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_1` };
        seg1Wrapper.name = `limb_${index}_joint_1`;
        
        seg1Wrapper.add(seg1);
        seg1Wrapper.add(seg1Hitbox); 
        pivotGroup.add(seg1Wrapper);

        const joint = new THREE.Mesh(new THREE.SphereGeometry(thickness * 0.8, 12, 12), jointMaterialRef.current);
        joint.position.y = seg1Length / 2;
        seg1.add(joint);

        const seg2Length = 2.0;
        
        const seg2BaseGeo = new THREE.ConeGeometry(thickness * 0.6, seg2Length, 6, 12);
        const seg2Geo = createWobblyGeometry(seg2BaseGeo, 0.02);
        const seg2 = new THREE.Mesh(seg2Geo, limbMaterialRef.current);
        seg2.position.y = seg2Length / 2;
        seg2.name = "visual";

        const seg2HitboxGeo = new THREE.ConeGeometry(0.3, seg2Length, 4);
        const seg2Hitbox = new THREE.Mesh(seg2HitboxGeo, invisibleMaterialRef.current);
        seg2Hitbox.position.y = seg2Length / 2;
        seg2Hitbox.userData = { isPart: true, isHitbox: true, limbIndex: index, segmentIndex: 2 };
        seg2Hitbox.name = "hitbox";

        const seg2Wrapper = new THREE.Group();
        seg2Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_2` };
        seg2Wrapper.name = `limb_${index}_joint_2`;
        seg2Wrapper.position.y = seg1Length; 

        seg2Wrapper.add(seg2);
        seg2Wrapper.add(seg2Hitbox);
        seg1Wrapper.add(seg2Wrapper);
    };

    angles.forEach((angle, i) => createLimb(true, angle, i));
    angles.forEach((angle, i) => createLimb(false, angle, i + 4));

    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            applyPoseToRef(JSON.parse(cached), creatureGroup);
        } else {
            applyPoseToRef(INITIAL_POSE, creatureGroup);
        }
    } catch (e) {
        applyPoseToRef(INITIAL_POSE, creatureGroup);
    }

    const tempV = new THREE.Vector3();

    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        
        // Update Labels (Individual for each segment)
        if (!isCanvasMode) {
            INDIVIDUAL_LABELS.forEach((item, index) => {
                const labelDiv = labelRefs.current[index];
                if (!labelDiv || !creatureGroup) return;

                const jointName = `limb_${item.limbIndex}_joint_${item.jointIndex}`;
                let targetMesh: THREE.Object3D | null = null;
                
                creatureGroup.traverse(obj => {
                    if (obj.name === jointName) {
                        const visual = obj.children.find(c => c.name === "visual");
                        if (visual) targetMesh = visual;
                    }
                });

                if (targetMesh) {
                    (targetMesh as THREE.Mesh).getWorldPosition(tempV);
                    const projV = tempV.clone().project(cameraRef.current!);

                    const x = (projV.x * .5 + .5) * window.innerWidth;
                    const y = (projV.y * -.5 + .5) * window.innerHeight;

                    // Orthographic projection logic for visibility
                    // Check if it's within the -1 to 1 range
                    if (Math.abs(projV.x) > 1.1 || Math.abs(projV.y) > 1.1) {
                         labelDiv.style.opacity = '0';
                    } else {
                        labelDiv.style.opacity = '1';
                        labelDiv.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
                    }
                }
            });
        }
      }
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  const applyPoseToRef = (pose: PoseData, group: THREE.Group) => {
      group.traverse((obj) => {
          if (obj.userData.isJoint && obj.userData.id && pose[obj.userData.id]) {
             const { x, y, z } = pose[obj.userData.id];
             obj.rotation.set(x, y, z);
          }
      });
  };

  const generateRandomPose = () => {
     const strategies = [
         () => {
             const j1 = { x: (Math.random()-0.5)*3, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 };
             const j2 = { x: (Math.random()-0.5)*3, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 };
             const pose: PoseData = {};
             for(let i=0; i<4; i++) { pose[`limb_${i}_joint_1`] = j1; pose[`limb_${i}_joint_2`] = j2; }
             for(let i=4; i<8; i++) { pose[`limb_${i}_joint_1`] = { x: -j1.x, y: j1.y, z: j1.z }; pose[`limb_${i}_joint_2`] = { x: -j2.x, y: j2.y, z: j2.z }; }
             return pose;
         },
         () => {
             const pose: PoseData = {};
             for(let i=0; i<8; i++) {
                 pose[`limb_${i}_joint_1`] = { x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 };
                 pose[`limb_${i}_joint_2`] = { x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 };
             }
             return pose;
         }
     ];
     const strategy = strategies[Math.floor(Math.random() * strategies.length)];
     if (creatureRef.current) applyPoseToRef(strategy(), creatureRef.current);
  };

  const saveSnapshot = () => {
      if (rendererRef.current) {
          const img = rendererRef.current.domElement.toDataURL("image/png");
          const link = document.createElement("a");
          link.download = `mento-pose-${Date.now()}.png`;
          link.href = img;
          link.click();
      }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = rendererRef.current!.domElement.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
    
    const intersects = raycasterRef.current.intersectObjects(creatureRef.current!.children, true);
    const hit = intersects.find(i => i.object.userData.isPart);

    previousPointerRef.current = { x: e.clientX, y: e.clientY };

    if (hit) {
        if (grabEnabled) {
             isDraggingRef.current = true;
             if (controlsRef.current) controlsRef.current.enabled = false;
             selectJoint(hit.object as THREE.Mesh);
             
             const wrapper = hit.object.parent; 
             if (wrapper) {
               const jointWorldPos = new THREE.Vector3();
               wrapper.getWorldPosition(jointWorldPos);
               jointWorldPosRef.current.copy(jointWorldPos);

               const camDir = new THREE.Vector3();
               cameraRef.current!.getWorldDirection(camDir);
               dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, jointWorldPos);
               
               const planeIntersect = new THREE.Vector3();
               raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, planeIntersect);
               
               if (planeIntersect) {
                   dragStartPointRef.current.copy(planeIntersect);
                   dragStartVectorRef.current.subVectors(planeIntersect, jointWorldPos).normalize();
               }
            }
        } else {
            selectJoint(hit.object as THREE.Mesh);
        }
    } else {
        if (selectedMeshRef.current) {
            selectedMeshRef.current.material = limbMaterialRef.current;
            selectedMeshRef.current = null;
            setSelectedId(null);
        }
    }
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!selectedMeshRef.current) return;

      const wrapper = selectedMeshRef.current.parent;
      if (!wrapper || !wrapper.userData.isJoint) return;

      const isLeverDrag = dragStartVectorRef.current.lengthSq() > 0.5;

      if (isLeverDrag) {
          const rect = rendererRef.current!.domElement.getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycasterRef.current.setFromCamera(new THREE.Vector2(nx, ny), cameraRef.current!);

          const planeIntersect = new THREE.Vector3();
          raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, planeIntersect);

          if (planeIntersect) {
              const currentVector = new THREE.Vector3().subVectors(planeIntersect, jointWorldPosRef.current).normalize();
              const startVector = dragStartVectorRef.current;
              const deltaQ = new THREE.Quaternion().setFromUnitVectors(startVector, currentVector);
              
              const currentWorldQ = new THREE.Quaternion();
              wrapper.getWorldQuaternion(currentWorldQ);
              
              const newWorldQ = deltaQ.multiply(currentWorldQ);
              const parent = wrapper.parent;
              const parentWorldQ = new THREE.Quaternion();
              if (parent) parent.getWorldQuaternion(parentWorldQ);
              wrapper.quaternion.copy(parentWorldQ.invert().multiply(newWorldQ));
              dragStartVectorRef.current.copy(currentVector);
          }
      } else {
          const deltaX = e.clientX - previousPointerRef.current.x;
          const deltaY = e.clientY - previousPointerRef.current.y;
          previousPointerRef.current = { x: e.clientX, y: e.clientY };

          const sensitivity = 0.005;
          const cam = cameraRef.current!;
          // For Orthographic, rotation interaction feels different, keep standard mapping for now
          // or simple trackball logic
          const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), deltaY * sensitivity);
          const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), deltaX * sensitivity);
          const deltaQ = rotY.multiply(rotX);
          
          const currentWorldQ = new THREE.Quaternion();
          wrapper.getWorldQuaternion(currentWorldQ);
          const newWorldQ = deltaQ.multiply(currentWorldQ);
          const parent = wrapper.parent;
          const parentWorldQ = new THREE.Quaternion();
          if (parent) parent.getWorldQuaternion(parentWorldQ);
          wrapper.quaternion.copy(parentWorldQ.invert().multiply(newWorldQ));
      }
  };

  const handlePointerUp = () => {
      isDraggingRef.current = false;
      dragStartVectorRef.current.set(0,0,0);
      if (controlsRef.current) {
          controlsRef.current.enabled = orbitEnabled;
      }
  };
  
  useEffect(() => {
      if (controlsRef.current) {
          controlsRef.current.enabled = orbitEnabled;
      }
  }, [orbitEnabled]);

  const selectJoint = (mesh: THREE.Mesh) => {
      let visualMesh = mesh;
      if (mesh.userData.isHitbox) {
          const parent = mesh.parent;
          if (parent) {
             const found = parent.children.find(c => c.name === "visual") as THREE.Mesh;
             if (found) visualMesh = found;
          }
      }

      if (selectedMeshRef.current) selectedMeshRef.current.material = limbMaterialRef.current;
      selectedMeshRef.current = visualMesh;
      selectedMeshRef.current.material = highlightMaterialRef.current;
      
      if (visualMesh.parent && visualMesh.parent.userData.isJoint) {
          setSelectedId(visualMesh.parent.userData.id);
      }
  };

  useEffect(() => {
      if (isCanvasMode && canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "black";
            ctxRef.current = ctx;
          }
      }
  }, [isCanvasMode]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      isDrawingRef.current = true;
      const { x, y } = getCoords(e);
      ctxRef.current?.beginPath();
      ctxRef.current?.moveTo(x, y);
  };
  
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current || !ctxRef.current) return;
      const { x, y } = getCoords(e);
      ctxRef.current.lineTo(x, y);
      ctxRef.current.stroke();
  };

  const stopDrawing = () => {
      isDrawingRef.current = false;
      ctxRef.current?.closePath();
  };
  
  const clearCanvas = () => {
      if (canvasRef.current && ctxRef.current) {
          ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
  };

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
      if ("touches" in e) {
          return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
  };

  const analyzeSketchAndApply = async () => {
      if (!canvasRef.current) return;
      setIsGenerating(true);
      try {
        if (!process.env.API_KEY) {
            throw new Error("API Key is missing. Please set the API_KEY environment variable.");
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const dataUrl = canvasRef.current.toDataURL("image/png");
        const base64Data = dataUrl.split(",")[1];
        
        const prompt = `
          Analyze this sketch of a 3D structure with 8 articulated limbs (4 top, 4 bottom).
          Return a JSON object with rotational values (x, y, z in radians) for all 16 joints.
          
          Structure:
          - 8 Limbs indexed 0 to 7.
          - Each limb has 2 joints: joint_1 (base/inner) and joint_2 (mid/outer).
          
          Required JSON Format:
          {
            "limb_0_joint_1": { "x": 0, "y": 0, "z": 0 },
            "limb_0_joint_2": { "x": 0, "y": 0, "z": 0 },
            ... (up to limb_7_joint_2)
          }
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/png", data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = stripMarkdown(response.text || "{}");
        const pose = JSON.parse(text);
        
        if (creatureRef.current) {
            applyPoseToRef(pose, creatureRef.current);
        }
        setIsCanvasMode(false);
      } catch (err) {
          console.error("Failed to generate pose", err);
          alert("Could not generate pose. Check console for details.");
      } finally {
          setIsGenerating(false);
      }
  };

  useEffect(() => {
    const palette = COLORS[theme];
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(palette.bg);
      if (sceneRef.current.fog) (sceneRef.current.fog as THREE.FogExp2).color.setHex(palette.fog);
    }
    limbMaterialRef.current.color.setHex(palette.limb);
    highlightMaterialRef.current.color.setHex(palette.limb);
    highlightMaterialRef.current.emissive.setHex(theme === 'dark' ? 0xff3b30 : 0xff453a); 
    jointMaterialRef.current.color.setHex(palette.joint);
    if (lightsRef.current) {
      lightsRef.current.ambient.color.setHex(palette.ambient);
      lightsRef.current.directional.color.setHex(palette.directional);
      lightsRef.current.back.color.setHex(palette.back);
    }
  }, [theme]);

  const handleResize = useCallback(() => {
    if (cameraRef.current && rendererRef.current) {
      const frustumSize = 12;
      const aspect = window.innerWidth / window.innerHeight;
      
      cameraRef.current.left = -frustumSize * aspect / 2;
      cameraRef.current.right = frustumSize * aspect / 2;
      cameraRef.current.top = frustumSize / 2;
      cameraRef.current.bottom = -frustumSize / 2;
      
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    }
    if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
    }
  }, []);
  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  const resetPose = () => { if (creatureRef.current) applyPoseToRef(INITIAL_POSE, creatureRef.current); };
  const copyPose = async () => {
      if (!creatureRef.current) return;
      const poseData: PoseData = {};
      creatureRef.current.traverse((obj) => {
          if (obj.userData.isJoint && obj.userData.id) {
              poseData[obj.userData.id] = {
                  x: Number(obj.rotation.x.toFixed(3)),
                  y: Number(obj.rotation.y.toFixed(3)),
                  z: Number(obj.rotation.z.toFixed(3))
              };
          }
      });
      const json = JSON.stringify(poseData, null, 2);
      localStorage.setItem(CACHE_KEY, json);
      try {
          await navigator.clipboard.writeText(json);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      } catch (err) { console.error(err); }
  };

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-black text-white' : 'bg-[#F2F2F7] text-black';
  
  const iconBtnClass = (active: boolean) => 
    `flex items-center justify-center w-12 h-12 rounded-full transition-all active:scale-95 shadow-md ${
      active 
       ? (isDark ? 'bg-white text-black' : 'bg-black text-white') 
       : (isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-white text-neutral-400')
    }`;
  
  const secondaryBtnClass = 
    `flex items-center justify-center w-10 h-10 rounded-full transition-all active:scale-90 ${
        isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-black'
    }`;
  
  const pillContainerClass = 
    `flex items-center gap-1 p-1 rounded-full shadow-sm border backdrop-blur-md ${
        isDark ? 'bg-neutral-900/80 border-white/5' : 'bg-white/80 border-black/5'
    }`;

  return (
    <div className={`relative w-full h-full overflow-hidden select-none transition-colors duration-500 ${bgClass}`}>
      <div 
        className="absolute inset-0 z-0 touch-none"
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      
      {/* 3D Labels Layer - Now Individual for each limb segment */}
      {!isCanvasMode && INDIVIDUAL_LABELS.map((item, i) => (
          <div 
             key={`${item.limbIndex}-${item.jointIndex}`}
             ref={el => labelRefs.current[i] = el}
             className={`absolute top-0 left-0 text-xs font-bold uppercase tracking-wider pointer-events-none transition-all duration-300 ${isDark ? 'text-white/60' : 'text-black/60'}`}
             style={{ opacity: 0 }} 
          >
              {item.text}
          </div>
      ))}

      {isCanvasMode && (
          <div className="absolute inset-0 z-50 bg-white cursor-crosshair touch-none">
              <canvas 
                ref={canvasRef}
                className="w-full h-full"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="absolute top-safe right-4 mt-12 flex flex-col gap-4">
                  <button onClick={() => setIsCanvasMode(false)} className="bg-black/10 hover:bg-black/20 p-3 rounded-full text-black">
                      <X size={24} />
                  </button>
                  <button onClick={clearCanvas} className="bg-black/10 hover:bg-black/20 p-3 rounded-full text-black">
                      <Trash2 size={24} />
                  </button>
              </div>

              <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center pointer-events-none">
                  <button 
                    onClick={analyzeSketchAndApply}
                    disabled={isGenerating}
                    className={`pointer-events-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 ${
                        isGenerating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-500'
                    } text-white`}
                  >
                      {isGenerating ? (
                        <RefreshCcw className="animate-spin" size={20} />
                      ) : (
                        <Sparkles size={20} />
                      )}
                      <span>Apply</span>
                  </button>
              </div>
          </div>
      )}

       {!isCanvasMode && (
       <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-4 z-40 pointer-events-none">
            <div className={`pointer-events-auto ${pillContainerClass}`}>
                  <button onClick={copyPose} className={secondaryBtnClass}>
                      {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16} />}
                  </button>
                  <button onClick={generateRandomPose} className={secondaryBtnClass}>
                      <Shuffle size={16} />
                  </button>
                  <button onClick={saveSnapshot} className={secondaryBtnClass}>
                      <Download size={16} />
                  </button>
            </div>
            <div className="flex items-center gap-4 pointer-events-auto">
                 <button onClick={() => setOrbitEnabled(!orbitEnabled)} className={iconBtnClass(orbitEnabled)}>
                    <Eye size={20} strokeWidth={2} />
                 </button>
                 <button onClick={() => setGrabEnabled(!grabEnabled)} className={iconBtnClass(grabEnabled)}>
                    <Hand size={20} strokeWidth={2} />
                 </button>
                 <div className="w-px h-6 bg-current opacity-20 mx-1"></div>
                 <button onClick={() => setIsCanvasMode(true)} className={iconBtnClass(false)}>
                    <Pencil size={20} strokeWidth={2} />
                 </button>
            </div>
            <button onClick={resetPose} className={`pointer-events-auto flex items-center justify-center w-8 h-8 rounded-full opacity-50 hover:opacity-100 transition-opacity ${isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black'}`}>
                <RefreshCcw size={14} />
            </button>
       </div>
       )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);