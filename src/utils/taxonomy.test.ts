import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

import { buildDataset, castTranslations, formatSlug } from '@/utils/taxonomy'

function getVisitPath(path: string[]): string {
  return path.at(-1) === '_tags' ? path.slice(0, -1).join('.') : path.join('.')
}

describe('taxonomy helpers', () => {
  it('builds nested nodes and aggregates tag counts', () => {
    const dataset = buildDataset(
      {
        _meta: { version: 'test' },
        root_a: {
          branch_b: ['alpha_tag', 'beta_tag'],
          branch_c: {
            leaf_d: ['gamma_tag'],
          },
        },
      },
      'default',
    )

    const rootA = dataset.nodes.root_a
    const branchB = dataset.nodes['root_a.branch_b']
    const branchC = dataset.nodes['root_a.branch_c']

    expect(rootA).toBeDefined()
    expect(branchB).toBeDefined()
    expect(branchC).toBeDefined()

    if (!rootA || !branchB || !branchC) {
      throw new Error('Expected taxonomy nodes to exist')
    }

    expect(dataset.totalNodeCount).toBe(4)
    expect(dataset.totalTagCount).toBe(3)
    expect(rootA.totalTagCount).toBe(3)
    expect(branchB.directTagCount).toBe(2)
    expect(branchC.descendantCount).toBe(1)
  })

  it('casts translation entries and falls back to slug formatting', () => {
    const translations = castTranslations({
      'category.subject': {
        en: 'subject',
        'zh-CN': '主体',
      },
    })

    expect(translations['category.subject']?.['zh-CN']).toBe('主体')
    expect(formatSlug('black_hair')).toBe('black hair')
  })

  it('supports direct node tags via _tags without creating a child node', () => {
    const dataset = buildDataset(
      {
        _meta: { version: 'test' },
        root_a: {
          _tags: ['alpha_tag'],
          branch_b: ['beta_tag'],
        },
      },
      'default',
    )

    const rootA = dataset.nodes.root_a
    const branchB = dataset.nodes['root_a.branch_b']

    expect(rootA).toBeDefined()
    expect(branchB).toBeDefined()

    if (!rootA || !branchB) {
      throw new Error('Expected taxonomy nodes to exist')
    }

    expect(rootA.tags).toEqual(['alpha_tag'])
    expect(rootA.children).toEqual(['root_a.branch_b'])
    expect(dataset.nodes['root_a._tags']).toBeUndefined()
    expect(rootA.directTagCount).toBe(1)
    expect(rootA.totalTagCount).toBe(2)
  })

  it('keeps selected head and shoulder anchor tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['animal_on_head', 'composition.framing.body_part_anchor.head'],
      ['book_on_head', 'composition.framing.body_part_anchor.head'],
      ['on_head', 'composition.framing.body_part_anchor.head'],
      ['animal_on_shoulder', 'composition.framing.body_part_anchor.shoulder.on_shoulder'],
      ['on_shoulder', 'composition.framing.body_part_anchor.shoulder.on_shoulder'],
      ['hands_on_shoulders', 'composition.framing.body_part_anchor.shoulder'],
      ['arm_over_shoulder', 'composition.framing.body_part_anchor.shoulder.over_shoulder'],
      ['holding_over_opposite_shoulder', 'composition.framing.body_part_anchor.shoulder.over_shoulder'],
      ['arm_around_shoulder', 'composition.framing.body_part_anchor.shoulder'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed).not.toHaveProperty('composition.framing.body_part_anchor.shoulder.on_shoulders')
    expect(parsed).not.toHaveProperty('composition.framing.body_part_anchor.shoulder.around_shoulder')
  })

  it('keeps lap placement tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedTags = new Set([
      'animal_on_lap',
      'bag_on_lap',
      'book_on_lap',
      'cat_on_lap',
      'creature_on_lap',
      'hand_on_lap',
      'hands_on_lap',
      'lap',
      'lying_on_lap',
      'on_lap',
      'pokemon_on_lap',
      'sitting_on_lap',
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedTags.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedTags.size)
    expect(rows.every((row) => row.path === 'composition.framing.body_part_anchor.lap')).toBe(true)
  })

  it('keeps selected face anchor tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['animal_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['butterfly_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['chocolate_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['cream_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['fan_over_face', 'composition.framing.body_part_anchor.face.over_face'],
      ['food_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['hair_over_face', 'composition.framing.body_part_anchor.face.over_face'],
      ['hand_over_face', 'composition.framing.body_part_anchor.face.over_face'],
      ['ice_cream_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['paint_splatter_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['phone_over_face', 'composition.framing.body_part_anchor.face.over_face'],
      ['pie_in_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['rice_on_face', 'composition.framing.body_part_anchor.face.on_face'],
      ['tail_on_face', 'composition.framing.body_part_anchor.face.on_face'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
    expect(parsed).not.toHaveProperty('apparel.body_part_placement.neck.behind_neck')
  })

  it('keeps selected headwear relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['adjusting_headwear', 'apparel.headwear.interaction'],
      ['cum_on_headwear', 'apparel.headwear.on_headwear'],
      ['eyewear_on_headwear', 'apparel.headwear.on_headwear'],
      ['goggles_on_headwear', 'apparel.headwear.on_headwear'],
      ['hand_on_headwear', 'apparel.headwear.interaction'],
      ['hands_on_headwear', 'apparel.headwear.interaction'],
      ['headphones_over_headwear', 'apparel.headwear'],
      ['headwear_switch', 'apparel.headwear.interaction'],
      ['putting_on_headwear', 'apparel.headwear.interaction'],
      ['snow_on_headwear', 'apparel.headwear.on_headwear'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
    expect(parsed).not.toHaveProperty('apparel.headwear.state')
    expect(parsed).not.toHaveProperty('apparel.headwear.over_headwear')
  })

  it('flattens redundant single-child wrappers in selected branches', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      apparel: {
        headwear: Record<string, unknown>
      }
      character: {
        archetype: {
          form: Record<string, unknown>
        }
      }
      dynamics: {
        action: {
          combat: Record<string, unknown>
          gesture: Record<string, unknown>
          object_manipulation: {
            holding: Record<string, unknown>
          }
        }
        interaction: {
          contact: Record<string, unknown>
        }
        pose: {
          arm_hand: Record<string, unknown>
        }
      }
    }
    const expectedPaths = new Map([
      ['inkling', 'character.archetype.form'],
      ['monster_girl', 'character.archetype.form.female'],
      ['elbow_rest', 'dynamics.pose.arm_hand.elbow_wrist'],
      ['head_rest', 'dynamics.pose.arm_hand.general'],
      ['asymmetrical_dual_wielding', 'dynamics.action.combat'],
      ['fighting_stance', 'dynamics.action.combat.stance'],
      ['attack', 'dynamics.action.combat.impact'],
      ['blowing_kiss', 'dynamics.action.gesture'],
      ['v', 'dynamics.action.gesture.general'],
      ['carrying_under_arm', 'dynamics.action.object_manipulation.holding'],
      ['mouth_hold', 'dynamics.action.object_manipulation.holding.grip_style'],
      ['holding', 'dynamics.action.object_manipulation.holding.general'],
      ['foot_on_another\'s_face', 'dynamics.interaction.contact'],
      ['hand_on_another\'s_head', 'dynamics.interaction.contact.hand_on'],
      ['glomp', 'dynamics.interaction.contact.general'],
      ['headphones_over_headwear', 'apparel.headwear'],
      ['cum_on_headwear', 'apparel.headwear.on_headwear'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.archetype.form).not.toHaveProperty('kemono_type')
    expect(parsed.character.archetype.form).not.toHaveProperty('neutral')
    expect(parsed.dynamics.action.combat).not.toHaveProperty('weapon_use')
    expect(parsed.dynamics.action.gesture).not.toHaveProperty('face_gesture')
    expect(parsed.dynamics.action.object_manipulation.holding).not.toHaveProperty(
      'general_object_hold',
    )
    expect(parsed.dynamics.action.object_manipulation.holding).not.toHaveProperty('carry_object')
    expect(parsed.dynamics.interaction.contact).not.toHaveProperty('touch')
    expect(parsed.dynamics.interaction.contact).not.toHaveProperty('leg_contact')
    expect(parsed.apparel.headwear).not.toHaveProperty('state')
    expect(parsed.apparel.headwear).not.toHaveProperty('over_headwear')
  })

  it('keeps selected neck apparel relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['bandaid_on_neck', 'apparel.body_part_placement.neck.on_neck'],
      ['bandage_on_neck', 'apparel.body_part_placement.neck.on_neck'],
      ['bandana_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['camera_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['chain_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['earmuffs_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['eyewear_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['furoshiki_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['gag_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['goggles_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['headband_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['headphones_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['jacket_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['mask_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['rope_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['shirt_behind_neck', 'apparel.body_part_placement.neck'],
      ['sign_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['stethoscope_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['stopwatch_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['string_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['sweater_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['towel_around_neck', 'apparel.body_part_placement.neck.around_neck'],
      ['whistle_around_neck', 'apparel.body_part_placement.neck.around_neck'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
  })

  it('keeps selected back anchor tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['animal_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['arms_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['arm_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['gun_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['hat_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['holding_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['holding_polearm_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['holding_sword_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['holding_weapon_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['instrument_case_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['instrument_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['pokemon_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['polearm_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['shield_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['sword_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['sword_on_back', 'composition.framing.body_part_anchor.back.on_back'],
      ['weapon_behind_back', 'composition.framing.body_part_anchor.back.behind_back'],
      ['weapon_on_back', 'composition.framing.body_part_anchor.back.on_back'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
  })

  it('keeps selected waist apparel relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['belt_around_waist', 'apparel.body_part_placement.waist'],
      ['cardigan_around_waist', 'apparel.body_part_placement.waist'],
      ['clothes_around_waist', 'apparel.body_part_placement.waist'],
      ['jacket_around_waist', 'apparel.body_part_placement.waist'],
      ['jumpsuit_around_waist', 'apparel.body_part_placement.waist'],
      ['rope_around_waist', 'apparel.body_part_placement.waist'],
      ['shirt_around_waist', 'apparel.body_part_placement.waist'],
      ['sweater_around_waist', 'apparel.body_part_placement.waist'],
      ['towel_around_waist', 'apparel.body_part_placement.waist'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
  })

  it('keeps selected wearable body relation tags consolidated', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      apparel: {
        body_part_placement: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['bandaid_on_head', 'apparel.body_part_placement.head'],
      ['bra_on_head', 'apparel.body_part_placement.head'],
      ['diving_mask_on_head', 'apparel.body_part_placement.head'],
      ['eyewear_on_head', 'apparel.body_part_placement.head'],
      ['goggles_on_head', 'apparel.body_part_placement.head'],
      ['mask_on_head', 'apparel.body_part_placement.head'],
      ['necktie_on_head', 'apparel.body_part_placement.head'],
      ['ofuda_on_head', 'apparel.body_part_placement.head'],
      ['panties_on_head', 'apparel.body_part_placement.head'],
      ['scarf_on_head', 'apparel.body_part_placement.head'],
      ['towel_on_head', 'apparel.body_part_placement.head'],
      ['bandage_on_face', 'apparel.body_part_placement.face'],
      ['bandaid_on_face', 'apparel.body_part_placement.face'],
      ['gauze_on_face', 'apparel.body_part_placement.face'],
      ['sticker_on_face', 'apparel.body_part_placement.face'],
      ['bandaid_on_shoulder', 'apparel.body_part_placement.shoulder'],
      ['cardigan_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['clothes_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['coat_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['haori_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['jacket_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['kimono_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['shirt_on_shoulders', 'apparel.body_part_placement.shoulder.on_shoulders'],
      ['jacket_over_shoulder', 'apparel.body_part_placement.shoulder'],
      ['bandaid_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['gauze_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['sticker_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['towel_on_arm', 'apparel.body_part_placement.arm.on_arm'],
      ['bandana_around_arm', 'apparel.body_part_placement.arm.around_arm'],
      ['chain_around_arm', 'apparel.body_part_placement.arm.around_arm'],
      ['bandaid_on_chest', 'apparel.body_part_placement.chest'],
      ['flower_on_chest', 'apparel.body_part_placement.chest'],
      ['bandaid_on_foot', 'apparel.body_part_placement'],
      ['bandaid_on_hand', 'apparel.body_part_placement'],
      ['bandaid_on_knee', 'apparel.body_part_placement.knee'],
      ['bandage_on_knee', 'apparel.body_part_placement.knee'],
      ['gauze_on_knee', 'apparel.body_part_placement.knee'],
      ['bandaid_on_leg', 'apparel.body_part_placement.leg'],
      ['bandage_on_leg', 'apparel.body_part_placement.leg'],
      ['gauze_on_leg', 'apparel.body_part_placement.leg'],
      ['ofuda_on_leg', 'apparel.body_part_placement.leg'],
      ['sticker_on_leg', 'apparel.body_part_placement.leg'],
      ['bandaid_on_stomach', 'apparel.body_part_placement'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(
      rows.every((row) => row.path === expectedPaths.get(row.tag)),
    ).toBe(true)
    expect(parsed.apparel.body_part_placement.head).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.face).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.shoulder).toHaveProperty('_tags')
    expect(parsed.apparel.body_part_placement.chest).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.knee).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.leg).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement.waist).toBeInstanceOf(Array)
    expect(parsed.apparel.body_part_placement).toHaveProperty('_tags')
    expect(parsed.apparel.body_part_placement.shoulder).not.toHaveProperty('on_shoulder')
    expect(parsed.apparel.body_part_placement.shoulder).not.toHaveProperty('over_shoulder')
    expect(parsed.apparel.body_part_placement.neck).not.toHaveProperty('behind_neck')
    expect(parsed.apparel.body_part_placement).not.toHaveProperty('foot')
    expect(parsed.apparel.body_part_placement).not.toHaveProperty('hand')
    expect(parsed.apparel.body_part_placement).not.toHaveProperty('stomach')
  })

  it('keeps selected semantic body-part tags in non-anchor domains', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as unknown
    const expectedPaths = new Map([
      ['blood_on_back', 'character.skin.blood'],
      ['blood_on_face', 'character.body.face.fluid_mess'],
      ['blood_on_shoulder', 'character.skin.blood'],
      ['bite_mark_on_shoulder', 'character.skin.scar_wound'],
      ['cum_on_back', 'explicit.sexual_fluid'],
      ['grabbed_breast_over_shoulder', 'explicit.sexual_act.general'],
      ['lipstick_mark_on_face', 'character.body.face.lips_mouth'],
      ['lipstick_mark_on_shoulder', 'character.skin.skin_mark'],
      ['mole_on_shoulder', 'character.skin.body_mole_freckle'],
      ['paizuri_on_lap', 'explicit.sexual_act.general'],
      ['penis_on_face', 'explicit.sexual_act.general'],
      ['penis_on_head', 'explicit.sexual_act.general'],
      ['penis_on_shoulder', 'explicit.sexual_act.general'],
      ['pussy_juice_on_face', 'explicit.sexual_fluid'],
      ['scar_on_head', 'character.skin.scar_wound'],
      ['scar_on_shoulder', 'character.skin.scar_wound'],
      ['snow_on_head', 'character.skin.texture_condition'],
      ['testicles_on_face', 'explicit.sexual_act.general'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
  })

  it('splits mixed body-part buckets into single-part categories', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      character: {
        body: {
          body_part: Record<string, unknown>
          face: Record<string, unknown>
        }
        skin: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['bare_shoulders', 'character.body.body_part.shoulder'],
      ['back', 'character.body.body_part.back'],
      ['thigh_gap', 'character.body.body_part.thigh'],
      ['broken_leg', 'character.body.body_part.leg'],
      ['knees', 'character.body.body_part.knee'],
      ['soles', 'character.body.body_part.foot'],
      ['toe_scrunch', 'character.body.body_part.toe'],
      ['palms', 'character.body.body_part.hand'],
      ['missing_finger', 'character.body.body_part.finger'],
      ['sharp_teeth', 'character.body.face.teeth'],
      ['fangs_out', 'character.body.face.fang'],
      ['body_blush', 'character.skin.blush'],
      ['glowing_veins', 'character.skin.vein'],
      ['sweat', 'character.skin.sweat'],
      ['oiled', 'character.skin'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.character.body.body_part).not.toHaveProperty('shoulder_back')
    expect(parsed.character.body.body_part).not.toHaveProperty('leg_thigh')
    expect(parsed.character.body.body_part).not.toHaveProperty('foot_toe')
    expect(parsed.character.body.body_part).not.toHaveProperty('hand_finger')
    expect(parsed.character.body.face).not.toHaveProperty('teeth_fang')
    expect(parsed.character.skin).not.toHaveProperty('blush_vein')
    expect(parsed.character.skin).not.toHaveProperty('sweat_oil')
    expect(parsed.character.skin).not.toHaveProperty('oil')
  })

  it('splits mixed mouth expression buckets into single-purpose categories', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      dynamics: {
        expression: {
          mouth: Record<string, unknown>
        }
      }
    }
    const expectedPaths = new Map([
      ['open_mouth', 'dynamics.expression.mouth.open'],
      ['closed_mouth', 'dynamics.expression.mouth'],
      ['smile', 'dynamics.expression.mouth.smile'],
      ['wrinkled_frown_(detective_pikachu)', 'dynamics.expression.mouth.frown'],
      ['biting_tongue', 'dynamics.expression.mouth.tongue_action'],
      ['saliva_trail_between_teeth', 'dynamics.expression.mouth'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('open_close')
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('smile_frown')
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('tongue_drool')
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('closed')
    expect(parsed.dynamics.expression.mouth).not.toHaveProperty('saliva')
  })

  it('renames broad container buckets without over-splitting their contents', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      object: {
        container: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['wine_glass', 'object.container.drinkware'],
      ['message_in_a_bottle', 'object.container.liquid_container'],
      ['rice_bowl', 'object.container.dishware'],
      ['shopping_bag', 'object.container.storage_container'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.object.container).not.toHaveProperty('cup_glass')
    expect(parsed.object.container).not.toHaveProperty('bottle_can')
    expect(parsed.object.container).not.toHaveProperty('plate_bowl')
    expect(parsed.object.container).not.toHaveProperty('box_bag')
  })

  it('reorganizes small invertebrates into clearer creature subgroups', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      creature: {
        insect_arthropod: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['mosquito', 'creature.insect_arthropod.insect'],
      ['spider', 'creature.insect_arthropod.arachnid'],
      ['centipede', 'creature.insect_arthropod.other_arthropod'],
      ['snail', 'creature.insect_arthropod.worm_mollusk'],
      ['slugcat', 'creature.insect_arthropod.misc'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.creature.insect_arthropod).not.toHaveProperty('insect_misc')
  })

  it('reorganizes meme tags by format instead of generic buckets', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      fandom: {
        meme: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['jack-o\'_challenge', 'fandom.meme.challenge_redraw'],
      ['padoru_(meme)', 'fandom.meme.character_icon'],
      ['me!me!me!_dance_(meme)', 'fandom.meme.dance_motion'],
      ['yamcha_pose_(meme)', 'fandom.meme.pose_scene'],
      ['pogchamp_(meme)', 'fandom.meme.reaction_expression'],
      ['oh?_you\'re_approaching_me?_(meme)', 'fandom.meme.quote_catchphrase'],
      ['drakeposting_(meme)', 'fandom.meme.template_macro'],
      ['114514_(meme)', 'fandom.meme.trend_meta'],
      ['pixiv_bottle_(meme)', 'fandom.meme.misc'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(parsed.fandom.meme).not.toHaveProperty('general')
    expect(parsed.fandom.meme).not.toHaveProperty('trend_meme')
  })

  it('reorganizes celestial bodies into astronomy-oriented subgroups', () => {
    const sourcePath = resolve(process.cwd(), 'data/source/danbooru_tag_tree_v3.yaml')
    const parsed = YAML.parse(readFileSync(sourcePath, 'utf8')) as {
      object: {
        celestial_body: Record<string, unknown>
      }
    }
    const expectedPaths = new Map([
      ['moon', 'object.celestial_body.moon.general'],
      ['full_moon', 'object.celestial_body.moon.phase'],
      ['red_moon', 'object.celestial_body.moon.color_variant'],
      ['broken_moon', 'object.celestial_body.moon.special'],
      ['sun', 'object.celestial_body.sun.general'],
      ['solar_eclipse', 'object.celestial_body.sun'],
      ['star_(sky)', 'object.celestial_body.star.general'],
      ['falling_star', 'object.celestial_body.star'],
      ['earth_(planet)', 'object.celestial_body.planet_system.named_planet'],
      ['planetary_ring', 'object.celestial_body.planet_system.general'],
      ['gemini_(constellation)', 'object.celestial_body.constellation_asterism.zodiac'],
      ['orion_(constellation)', 'object.celestial_body.constellation_asterism.named'],
      ['big_dipper', 'object.celestial_body.constellation_asterism.general'],
      ['meteor_shower', 'object.celestial_body.small_body'],
      ['comet', 'object.celestial_body.small_body.general'],
      ['nebula', 'object.celestial_body.cosmic_structure.galaxy_nebula'],
      ['black_hole', 'object.celestial_body.cosmic_structure.gravity_well'],
      ['wormhole', 'object.celestial_body.cosmic_structure.gravity_well'],
    ])
    const rows: Array<{ tag: string, path: string }> = []

    function visit(value: unknown, path: string[]): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && expectedPaths.has(item)) {
            rows.push({ tag: item, path: getVisitPath(path) })
          }
        }

        return
      }

      if (typeof value !== 'object' || value === null) {
        return
      }

      for (const [key, nestedValue] of Object.entries(value)) {
        visit(nestedValue, [...path, key])
      }
    }

    visit(parsed, [])

    expect(rows).toHaveLength(expectedPaths.size)
    expect(rows.every((row) => row.path === expectedPaths.get(row.tag))).toBe(true)
    expect(Array.isArray(parsed.object.celestial_body)).toBe(false)
    expect(parsed.object.celestial_body.sun).not.toHaveProperty('eclipse')
    expect(parsed.object.celestial_body.star).not.toHaveProperty('motion')
    expect(parsed.object.celestial_body.small_body).not.toHaveProperty('shower')
  })
})
