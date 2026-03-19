import { createRouter, createWebHashHistory } from 'vue-router'

import TaxonomyView from '@/views/TaxonomyView.vue'

import {
  DEFAULT_LOCALE,
  DEFAULT_VIEW,
  TAXONOMY_ROUTE_NAME,
} from '@/router/routeState'

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: {
        name: TAXONOMY_ROUTE_NAME,
        params: {
          locale: DEFAULT_LOCALE,
          view: DEFAULT_VIEW,
        },
      },
    },
    {
      path: '/:locale(zh-CN|en|ja)/:view(tree|graph)/:nodeId?',
      name: TAXONOMY_ROUTE_NAME,
      component: TaxonomyView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: {
        name: TAXONOMY_ROUTE_NAME,
        params: {
          locale: DEFAULT_LOCALE,
          view: DEFAULT_VIEW,
        },
      },
    },
  ],
})
