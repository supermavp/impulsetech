import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService, UserRole } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.getUserData$().pipe(
      take(1),
      map(userData => {
        if (!userData) {
          router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
          return false;
        }

        // Admin tiene acceso a todo
        if (userData.role === 'admin') {
          return true;
        }

        // Verificar si el usuario tiene uno de los roles permitidos
        if (allowedRoles.includes(userData.role)) {
          return true;
        }

        // Si no tiene permiso, redirigir según su rol
        switch (userData.role) {
          case 'teacher':
            router.navigate(['/teacher']);
            break;
          case 'student':
            router.navigate(['/student']);
            break;
          default:
            router.navigate(['/dashboard']);
        }
        return false;
      })
    );
  };
};

