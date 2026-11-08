import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'core/theme.dart';

void main() {
  runApp(const ProviderScope(child: TalentroApp()));
}

class TalentroApp extends StatelessWidget {
  const TalentroApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'Talentro',
    theme: AppTheme.mobile,
    routerConfig: appRouter,
    debugShowCheckedModeBanner: false,
  );
}
