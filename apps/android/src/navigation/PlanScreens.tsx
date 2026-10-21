// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's plan and the screens it opens, as routes (#225): the plan, where
// a parallel class replaces the one shown in place, the pack's details, one
// item with the class's changes to it, the class's changes, its layers and
// their import and export, and a report of an error in an item.
// `planRoutes` gives the navigator their entries, as `calendarRoutes` does.

import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClassPlan } from '../classes/ClassPlan';
import { LayerExport } from '../plan/LayerExport';
import { LayerImport } from '../plan/LayerImport';
import { PlanChanges } from '../plan/PlanChanges';
import { PlanLayers } from '../plan/PlanLayers';
import { PlanDetails } from '../plan/PlanDetails';
import { PlanError } from '../plan/PlanError';
import { SeptCheck } from '../plan/SeptCheck';
import { PlanItem } from '../plan/PlanItem';
import type { useText } from '../text/i18n';
import type { RootStackParamList } from './routes';

/** A class's plan. */
export function ClassPlanScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ClassPlan'>) {
  const { courseId } = route.params;
  return (
    <ClassPlan
      courseId={courseId}
      onExtra={() => navigation.navigate('Extra', { courseId })}
      onTests={() => navigation.navigate('TestSchedule', { courseId })}
      onExamWindow={() => navigation.navigate('ExamWindow', { courseId })}
      onCourse={(id) => navigation.setParams({ courseId: id })}
      onDetails={() => navigation.navigate('PlanDetails', { courseId })}
      onChanges={() => navigation.navigate('PlanChanges', { courseId })}
      onLayers={() => navigation.navigate('PlanLayers', { courseId })}
      onItem={(itemId) => navigation.navigate('PlanItem', { courseId, itemId })}
      onCheck={() => navigation.navigate('SeptCheck', { courseId })}
    />
  );
}

/** The details of the pack a class's plan follows. */
export function PlanDetailsScreen({ route }: NativeStackScreenProps<RootStackParamList, 'PlanDetails'>) {
  return <PlanDetails courseId={route.params.courseId} />;
}

/** One item of a class's plan, and the class's changes to it. */
export function PlanItemScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'PlanItem'>) {
  const { courseId, itemId } = route.params;
  return (
    <PlanItem
      courseId={courseId}
      itemId={itemId}
      onChanges={() => navigation.navigate('PlanChanges', { courseId })}
      onReport={() => navigation.navigate('PlanError', { courseId, itemId })}
    />
  );
}

/** A class's own changes to its plan. */
export function PlanChangesScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'PlanChanges'>) {
  return <PlanChanges courseId={route.params.courseId} onCourse={(id) => navigation.setParams({ courseId: id })} />;
}

/** The layers of a class's plan, each with the class's own switch. */
export function PlanLayersScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'PlanLayers'>) {
  const { courseId } = route.params;
  return (
    <PlanLayers
      courseId={courseId}
      onCourse={(id) => navigation.setParams({ courseId: id })}
      onChanges={() => navigation.navigate('PlanChanges', { courseId })}
      onDetails={() => navigation.navigate('PlanDetails', { courseId })}
      onImport={() => navigation.navigate('LayerImport', { courseId })}
      onExport={() => navigation.navigate('LayerExport', { courseId })}
    />
  );
}

/** Importing a district or school layer; taking one in goes back to the layers. */
export function LayerImportScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'LayerImport'>) {
  return <LayerImport courseId={route.params.courseId} onTaken={() => navigation.goBack()} />;
}

/** A school layer from the class's changes, to share with colleagues. */
export function LayerExportScreen({ route }: NativeStackScreenProps<RootStackParamList, 'LayerExport'>) {
  return <LayerExport courseId={route.params.courseId} />;
}

/** A report of an error in one item of a class's plan. */
export function PlanErrorScreen({ route }: NativeStackScreenProps<RootStackParamList, 'PlanError'>) {
  return <PlanError courseId={route.params.courseId} itemId={route.params.itemId} />;
}

/** The September check for an inspector. */
export function SeptCheckScreen({ route }: NativeStackScreenProps<RootStackParamList, 'SeptCheck'>) {
  return <SeptCheck courseId={route.params.courseId} />;
}

type Stack = ReturnType<typeof createNativeStackNavigator<RootStackParamList>>;

/** The plan's routes, for the app's navigator. */
export function planRoutes(Stack: Stack, t: ReturnType<typeof useText>) {
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <>
      <Stack.Screen name="ClassPlan" component={ClassPlanScreen} options={dark(t('classPlan.title'))} />
      <Stack.Screen name="PlanDetails" component={PlanDetailsScreen} options={dark(t('planDetails.title'))} />
      <Stack.Screen name="PlanItem" component={PlanItemScreen} options={dark(t('planItem.title'))} />
      <Stack.Screen name="PlanChanges" component={PlanChangesScreen} options={dark(t('planChanges.title'))} />
      <Stack.Screen name="PlanLayers" component={PlanLayersScreen} options={dark(t('planLayers.title'))} />
      <Stack.Screen name="LayerImport" component={LayerImportScreen} options={dark(t('planLayers.import'))} />
      <Stack.Screen name="LayerExport" component={LayerExportScreen} options={dark(t('planLayers.export.title'))} />
      <Stack.Screen name="PlanError" component={PlanErrorScreen} options={dark(t('planError.title'))} />
      <Stack.Screen name="SeptCheck" component={SeptCheckScreen} options={dark(t('septCheck.title'))} />
    </>
  );
}
