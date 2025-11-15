import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  currentUser = signal<User | null>(null);

  constructor() {
    // Suscribirse a los cambios del usuario
    this.authService.user$.subscribe(async user => {
      this.currentUser.set(user);
      if (!user) {
        this.router.navigate(['/login']);
      } else {
        // Redirigir según el rol
        const userData = this.authService.currentUserData();
        if (userData) {
          switch (userData.role) {
            case 'admin':
              await this.router.navigate(['/admin']);
              break;
            case 'teacher':
              await this.router.navigate(['/teacher']);
              break;
            case 'student':
              await this.router.navigate(['/student']);
              break;
          }
        } else {
          // Si no hay datos del usuario aún, esperar un momento
          setTimeout(async () => {
            const userData = this.authService.currentUserData();
            if (userData) {
              switch (userData.role) {
                case 'admin':
                  await this.router.navigate(['/admin']);
                  break;
                case 'teacher':
                  await this.router.navigate(['/teacher']);
                  break;
                case 'student':
                  await this.router.navigate(['/student']);
                  break;
              }
            }
          }, 1000);
        }
      }
    });
  }

  async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    return user?.displayName || user?.email || 'Usuario';
  }

  getUserEmail(): string {
    const user = this.currentUser();
    return user?.email || '';
  }

  getUserPhoto(): string | null {
    const user = this.currentUser();
    return user?.photoURL || null;
  }

  getProviderName(): string {
    const user = this.currentUser();
    if (!user || !user.providerData || user.providerData.length === 0) {
      return 'Email';
    }
    const providerId = user.providerData[0]?.providerId;
    return providerId === 'google.com' ? 'Google' : 'Email';
  }

  getCreationDate(): string {
    const user = this.currentUser();
    if (!user || !user.metadata?.creationTime) {
      return 'N/A';
    }
    return new Date(user.metadata.creationTime).toLocaleDateString('es-ES');
  }
}

