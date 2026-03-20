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
        name: `${TAXONOMY_ROUTE_NAME}-${DEFAULT_VIEW}`,
        params: {
          locale: DEFAULT_LOCALE,
        },
      },
    },
    {
      path: '/:locale(zh-CN|en|ja)',
      component: TaxonomyView,
      children: [
        {
          path: 'tree/:nodeId?',
          name: `${TAXONOMY_ROUTE_NAME}-tree`,
          component: () => import('@/views/TreePage.vue'),
        },
        {
          path: 'graph/:nodeId?',
          name: `${TAXONOMY_ROUTE_NAME}-graph`,
          component: () => import('@/views/GraphPage.vue'),
        },
        {
          path: '',
          redirect: (to) => ({
            name: `${TAXONOMY_ROUTE_NAME}-${DEFAULT_VIEW}`,
            params: { locale: to.params.locale },
          }),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: {
        name: `${TAXONOMY_ROUTE_NAME}-${DEFAULT_VIEW}`,
        params: {
          locale: DEFAULT_LOCALE,
        },
      },
    },
  ],
})
