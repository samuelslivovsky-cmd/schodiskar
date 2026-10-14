// Vstup pre esbuild: vybrané časti three.js ako globálny objekt window.THREE (pre offline index.html)
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, Group, Mesh, BufferGeometry, Float32BufferAttribute,
  ExtrudeGeometry, Shape, Path, BoxGeometry, CylinderGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Vector2,
  MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace,
  ACESFilmicToneMapping, PCFSoftShadowMap, HemisphereLight, DirectionalLight, AmbientLight, PointLight, PMREMGenerator,
  DoubleSide, FrontSide, BackSide, PlaneGeometry, SphereGeometry, Box3, MathUtils, Quaternion, Euler, Matrix4
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
window.THREE = {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, Group, Mesh, BufferGeometry, Float32BufferAttribute,
  ExtrudeGeometry, Shape, Path, BoxGeometry, CylinderGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Vector2,
  MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace,
  ACESFilmicToneMapping, PCFSoftShadowMap, HemisphereLight, DirectionalLight, AmbientLight, PointLight, PMREMGenerator,
  DoubleSide, FrontSide, BackSide, PlaneGeometry, SphereGeometry, Box3, MathUtils, Quaternion, Euler, Matrix4,
  OrbitControls, RoomEnvironment, mergeGeometries
};
