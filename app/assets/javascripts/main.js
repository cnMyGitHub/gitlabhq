/* global $ */

import jQuery from 'jquery';
import Cookies from 'js-cookie';

// bootstrap webpack, common libs, polyfills, and behaviors
import './webpack';
import './commons';
import './behaviors';

// lib/utils
import applyGitLabUIConfig from '@gitlab/ui/dist/config';
import { GlBreakpointInstance as bp } from '@gitlab/ui/dist/utils';
import {
  handleLocationHash,
  addSelectOnFocusBehaviour,
  getCspNonceValue,
} from './lib/utils/common_utils';
import { localTimeAgo } from './lib/utils/datetime_utility';
import { getLocationHash, visitUrl } from './lib/utils/url_utility';

// everything else
import loadAwardsHandler from './awards_handler';
import { deprecatedCreateFlash as Flash, removeFlashClickListener } from './flash';
import initTodoToggle from './header';
import initImporterStatus from './importer_status';
import initLayoutNav from './layout_nav';
import './feature_highlight/feature_highlight_options';
import LazyLoader from './lazy_loader';
import initLogoAnimation from './logo';
import initFrequentItemDropdowns from './frequent_items';
import initBreadcrumbs from './breadcrumb';
import initUsagePingConsent from './usage_ping_consent';
import initPerformanceBar from './performance_bar';
import initSearchAutocomplete from './search_autocomplete';
import GlFieldErrors from './gl_field_errors';
import initUserPopovers from './user_popovers';
import initBroadcastNotifications from './broadcast_notification';
import initPersistentUserCallouts from './persistent_user_callouts';
import { initUserTracking } from './tracking';
import { __ } from './locale';

import 'ee_else_ce/main_ee';

applyGitLabUIConfig();

// expose jQuery as global (TODO: remove these)
window.jQuery = jQuery;
window.$ = jQuery;

// Add nonce to jQuery script handler
jQuery.ajaxSetup({
  converters: {
    // eslint-disable-next-line @gitlab/require-i18n-strings, func-names
    'text script': function(text) {
      jQuery.globalEval(text, { nonce: getCspNonceValue() });
      return text;
    },
  },
});

function disableJQueryAnimations() {
  $.fx.off = true;
}

// Disable jQuery animations
if (gon?.disable_animations) {
  disableJQueryAnimations();
}

// inject test utilities if necessary
if (process.env.NODE_ENV !== 'production' && gon?.test_env) {
  disableJQueryAnimations();
  import(/* webpackMode: "eager" */ './test_utils/'); // eslint-disable-line no-unused-expressions
}

document.addEventListener('beforeunload', () => {
  // Unbind scroll events
  $(document).off('scroll');
  // Close any open tooltips
  $('.has-tooltip, [data-toggle="tooltip"]').tooltip('dispose');
  // Close any open popover
  $('[data-toggle="popover"]').popover('dispose');
});

window.addEventListener('hashchange', handleLocationHash);
window.addEventListener(
  'load',
  function onLoad() {
    window.removeEventListener('load', onLoad, false);
    handleLocationHash();
  },
  false,
);

gl.lazyLoader = new LazyLoader({
  scrollContainer: window,
  observerNode: '#content-body',
});

// Put all initialisations here that can also wait after everything is rendered and ready
function deferredInitialisation() {
  const $body = $('body');

  initBreadcrumbs();
  initImporterStatus();
  initTodoToggle();
  initLogoAnimation();
  initUsagePingConsent();
  initUserPopovers();
  initBroadcastNotifications();
  initFrequentItemDropdowns();
  initPersistentUserCallouts();

  if (document.querySelector('.search')) initSearchAutocomplete();

  addSelectOnFocusBehaviour('.js-select-on-focus');

  $('.remove-row').on('ajax:success', function removeRowAjaxSuccessCallback() {
    $(this)
      .tooltip('dispose')
      .closest('li')
      .fadeOut();
  });

  $('.js-remove-tr').on('ajax:before', function removeTRAjaxBeforeCallback() {
    $(this).hide();
  });

  $('.js-remove-tr').on('ajax:success', function removeTRAjaxSuccessCallback() {
    // eslint-disable-next-line no-jquery/no-fade
    $(this)
      .closest('tr')
      .fadeOut();
  });

  const glTooltipDelay = localStorage.getItem('gl-tooltip-delay');
  const delay = glTooltipDelay ? JSON.parse(glTooltipDelay) : 0;

  // Initialize tooltips
  $body.tooltip({
    selector: '.has-tooltip, [data-toggle="tooltip"]',
    trigger: 'hover',
    boundary: 'viewport',
    delay,
  });

  // Initialize popovers
  $body.popover({
    selector: '[data-toggle="popover"]',
    trigger: 'focus',
    // set the viewport to the main content, excluding the navigation bar, so
    // the navigation can't overlap the popover
    viewport: '.layout-page',
  });

  loadAwardsHandler();

  // Adding a helper class to activate animations only after all is rendered
  setTimeout(() => $body.addClass('page-initialised'), 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  const $body = $('body');
  const $document = $(document);
  const bootstrapBreakpoint = bp.getBreakpointSize();

  if (document.querySelector('#js-peek')) initPerformanceBar({ container: '#js-peek' });

  initUserTracking();
  initLayoutNav();

  // Set the default path for all cookies to GitLab's root directory
  Cookies.defaults.path = gon.relative_url_root || '/';

  // `hashchange` is not triggered when link target is already in window.location
  $body.on('click', 'a[href^="#"]', function clickHashLinkCallback() {
    const href = this.getAttribute('href');
    if (href.substr(1) === getLocationHash()) {
      setTimeout(handleLocationHash, 1);
    }
  });

  /**
   * TODO: Apparently we are collapsing the right sidebar on certain screensizes per default
   * except on issue board pages. Why can't we do it with CSS?
   *
   * Proposal: Expose a global sidebar API, which we could import wherever we are manipulating
   * the visibility of the sidebar.
   *
   * Quick fix: Get rid of jQuery for this implementation
   */
  const isBoardsPage = /(projects|groups):boards:show/.test(document.body.dataset.page);
  if (!isBoardsPage && (bootstrapBreakpoint === 'sm' || bootstrapBreakpoint === 'xs')) {
    const $rightSidebar = $('aside.right-sidebar');
    const $layoutPage = $('.layout-page');

    if ($rightSidebar.length > 0) {
      $rightSidebar.removeClass('right-sidebar-expanded').addClass('right-sidebar-collapsed');
      $layoutPage.removeClass('right-sidebar-expanded').addClass('right-sidebar-collapsed');
    } else {
      $layoutPage.removeClass('right-sidebar-expanded right-sidebar-collapsed');
    }
  }

  // prevent default action for disabled buttons
  $('.btn').click(function clickDisabledButtonCallback(e) {
    if ($(this).hasClass('disabled')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }

    return true;
  });

  localTimeAgo($('abbr.timeago, .js-timeago'), true);

  /**
   * This disables form buttons while a form is submitting
   * We do not difinitively know all of the places where this is used
   *
   * TODO: Defer execution, migrate to behaviors, and add sentry logging
   */
  $body.on('ajax:complete, ajax:beforeSend, submit', 'form', function ajaxCompleteCallback(e) {
    const $buttons = $('[type="submit"], .js-disable-on-submit', this).not('.js-no-auto-disable');
    switch (e.type) {
      case 'ajax:beforeSend':
      case 'submit':
        return $buttons.disable();
      default:
        return $buttons.enable();
    }
  });

  // eslint-disable-next-line no-jquery/no-ajax-events
  $(document).ajaxError((e, xhrObj) => {
    const ref = xhrObj.status;

    if (ref === 401) {
      Flash(__('You need to be logged in.'));
    } else if (ref === 404 || ref === 500) {
      Flash(__('Something went wrong on our end.'));
    }
  });

  $('.navbar-toggler').on('click', () => {
    $('.header-content').toggleClass('menu-expanded');
  });

  /**
   * Show suppressed commit diff
   *
   * TODO: Move to commit diff pages
   */
  $document.on('click', '.diff-content .js-show-suppressed-diff', function showDiffCallback() {
    const $container = $(this).parent();
    $container.next('table').show();
    $container.remove();
  });

  // Show/hide comments on diff
  $body.on('click', '.js-toggle-diff-comments', function toggleDiffCommentsCallback(e) {
    const $this = $(this);
    const notesHolders = $this.closest('.diff-file').find('.notes_holder');

    e.preventDefault();

    $this.toggleClass('active');

    if ($this.hasClass('active')) {
      notesHolders
        .show()
        .find('.hide, .content')
        .show();
    } else {
      notesHolders
        .hide()
        .find('.content')
        .hide();
    }

    $(document).trigger('toggle.comments');
  });

  $('form.filter-form').on('submit', function filterFormSubmitCallback(event) {
    const link = document.createElement('a');
    link.href = this.action;

    const action = `${this.action}${link.search === '' ? '?' : '&'}`;

    event.preventDefault();
    // eslint-disable-next-line no-jquery/no-serialize
    visitUrl(`${action}${$(this).serialize()}`);
  });

  const flashContainer = document.querySelector('.flash-container');

  if (flashContainer && flashContainer.children.length) {
    flashContainer
      .querySelectorAll('.flash-alert, .flash-notice, .flash-success')
      .forEach(flashEl => {
        removeFlashClickListener(flashEl);
      });
  }

  // initialize field errors
  $('.gl-show-field-errors').each((i, form) => new GlFieldErrors(form));

  requestIdleCallback(deferredInitialisation);
});
