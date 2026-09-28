// build_scene() for the building: runs every generator in construction order
// and returns the element set + layout. Pure data: runs in Node (validation)
// and in the browser (rendering).
import { ElementSet } from '../core/modules.js';
import { makeLayout } from './layout.js';
import { createFoundation, createColumns, createBeams, createFloorSlabs } from './structure.js';
import { createWalls, createOpenings, createFeatures, createParapets, createPipes } from './envelope.js';
import { createPavilion, pavilionFootings } from './pavilion.js';
import { createRoofs } from './roof.js';
import { createTower } from './tower.js';
import { createSite } from './site.js';
import { createCraneElements } from './crane.js';

export async function buildSchool() {
  const L = makeLayout();
  const ES = new ElementSet();
  createFoundation(ES, L, pavilionFootings(L));   // create_foundation()
  createColumns(ES, L);                           // create_columns()
  createBeams(ES, L);                             // create_beams()
  createFloorSlabs(ES, L);                        // create_floor_slab()
  createWalls(ES, L);                             // create_walls()
  createOpenings(ES, L);                          // create_windows() / create_doors()
  createFeatures(ES, L);                          // create_balconies(): chajjas, bands, corbels, steps
  createParapets(ES, L);                          // roof parapets
  createPipes(ES, L);                             // rainwater pipes (finishes)
  createPavilion(ES, L);                          // porch block, railings/grilles, clay-tile roof
  createRoofs(ES, L);                             // create_roof(): terrace roofs, red gables
  createTower(ES, L);                             // tower room, roof, tank, signage
  createSite(ES, L);                              // create_site(): setting out + site works
  createCraneElements(ES, L);                     // temporary works
  return { L, ES };
}
