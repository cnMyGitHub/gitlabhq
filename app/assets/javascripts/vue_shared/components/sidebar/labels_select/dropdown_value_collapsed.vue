<script>
import { GlIcon } from '@gitlab/ui';
import { s__, sprintf } from '~/locale';
import tooltip from '~/vue_shared/directives/tooltip';

export default {
  directives: {
    tooltip,
  },
  components: {
    GlIcon,
  },
  props: {
    labels: {
      type: Array,
      required: true,
    },
  },
  computed: {
    labelsList() {
      const labelsString = this.labels.length
        ? this.labels
            .slice(0, 5)
            .map(label => label.title)
            .join(', ')
        : s__('LabelSelect|Labels');

      if (this.labels.length > 5) {
        return sprintf(s__('LabelSelect|%{labelsString}, and %{remainingLabelCount} more'), {
          labelsString,
          remainingLabelCount: this.labels.length - 5,
        });
      }

      return labelsString;
    },
  },
  methods: {
    handleClick() {
      this.$emit('onValueClick');
    },
  },
};
</script>

<template>
  <div
    v-tooltip
    :title="labelsList"
    class="sidebar-collapsed-icon"
    data-placement="left"
    data-container="body"
    data-boundary="viewport"
    @click="handleClick"
  >
    <gl-icon name="labels" />
    <span>{{ labels.length }}</span>
  </div>
</template>
