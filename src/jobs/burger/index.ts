import type { ModelSpec } from '../../assets';
import type { JobEntry } from '../types';
import { BurgerJob } from './job';
import * as T from './texts';

const M = `${import.meta.env.BASE_URL}models/burger`;

/** Models of the burger job, all CC0 Kenney kits (see the License.txt files next to them). */
const MODELS: Record<string, ModelSpec> = {
  // food
  bg_turkey: { url: `${M}/food/turkey.glb`, width: 0.55 },
  bg_spatula: { url: `${M}/food/cooking-spatula.glb`, width: 0.34 },
  bg_oil: { url: `${M}/food/bottle-oil.glb`, height: 0.28 },
  bg_ketchup: { url: `${M}/food/bottle-ketchup.glb`, height: 0.22 },
  bg_mustard: { url: `${M}/food/bottle-musterd.glb`, height: 0.22 },
  bg_pan: { url: `${M}/food/frying-pan.glb`, width: 0.45 },
  bg_pot: { url: `${M}/food/pot.glb`, width: 0.36 },
  bg_board: { url: `${M}/food/cutting-board.glb`, width: 0.42 },
  bg_knife: { url: `${M}/food/cooking-knife.glb`, width: 0.3 },
  bg_cone: { url: `${M}/food/ice-cream-cne.glb`, height: 0.18 },
  bg_cheeseWheel: { url: `${M}/food/cheese.glb`, width: 0.32 },
  bg_styro: { url: `${M}/food/styrofoam.glb`, width: 0.26 },
  bg_burger: { url: `${M}/food/burger.glb`, height: 0.11 },
  bg_friesBox: { url: `${M}/food/fries.glb`, height: 0.18 },
  bg_soda: { url: `${M}/food/soda.glb`, height: 0.2 },
  bg_canCrushed: { url: `${M}/food/soda-can-crushed.glb`, width: 0.1 },
  bg_salt: { url: `${M}/food/shaker-salt.glb`, height: 0.1 },
  bg_barrel: { url: `${M}/food/barrel.glb`, height: 0.9 },
  // furniture
  bg_fridgeL: { url: `${M}/furniture/kitchenFridgeLarge.glb`, height: 2.0 },
  bg_micro: { url: `${M}/furniture/kitchenMicrowave.glb`, width: 0.5 },
  bg_toaster: { url: `${M}/furniture/toaster.glb`, width: 0.28 },
  bg_blender: { url: `${M}/furniture/kitchenBlender.glb`, height: 0.36 },
  bg_radio: { url: `${M}/furniture/radio.glb`, width: 0.34 },
  bg_coatRack: { url: `${M}/furniture/coatRack.glb`, height: 1.8 },
  bg_screen: { url: `${M}/furniture/computerScreen.glb`, width: 0.5 },
  bg_chair: { url: `${M}/furniture/chair.glb`, height: 0.95 },
  // cars and shop
  bg_sedan: { url: `${M}/car/sedan.glb`, width: 4.0 },
  bg_suv: { url: `${M}/car/suv.glb`, width: 4.2 },
  bg_taxi: { url: `${M}/car/taxi.glb`, width: 4.0 },
  bg_van: { url: `${M}/car/van.glb`, width: 4.6 },
  bg_trafficCone: { url: `${M}/car/cone.glb`, height: 0.5 },
  bg_gacha: { url: `${M}/shop/gacha-machine.glb`, height: 1.5 },
  bg_handTruck: { url: `${M}/shop/hand-truck.glb`, height: 1.2 },
};

/** Burger Flipper at MEGABYTE BURGER (Branch 404). */
export const BURGER_ENTRY: JobEntry | null = {
  id: 'burger',
  title: 'Burger Flipper',
  place: T.PLACE,
  teaser: 'The ice cream machine is broken.',
  models: MODELS,
  create: (scene) => new BurgerJob(scene),
};
