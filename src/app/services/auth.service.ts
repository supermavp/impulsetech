import { Injectable, inject, signal } from '@angular/core';
import { 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  user,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  
  // Signal para el usuario actual
  currentUser = signal<User | null>(null);
  
  // Observable del estado del usuario
  user$ = user(this.auth);

  constructor() {
    // Suscribirse a los cambios del usuario
    this.user$.subscribe(user => {
      this.currentUser.set(user);
    });
  }

  // Login con email y contraseña
  async login(email: string, password: string): Promise<void> {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      this.currentUser.set(credential.user);
      await this.router.navigate(['/dashboard']);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Registro con email y contraseña
  async register(email: string, password: string, displayName?: string, phone?: string): Promise<void> {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Actualizar el perfil con el nombre si se proporciona
      if (displayName && credential.user) {
        await updateProfile(credential.user, { displayName });
      }
      
      // Guardar información adicional del usuario en Firestore
      if (credential.user) {
        await this.saveUserData(credential.user.uid, {
          email: credential.user.email || email,
          displayName: displayName || '',
          phone: phone || '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      this.currentUser.set(credential.user);
      await this.router.navigate(['/dashboard']);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Guardar información del usuario en Firestore
  private async saveUserData(uid: string, userData: any): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      await setDoc(userRef, userData, { merge: true });
    } catch (error) {
      console.error('Error al guardar datos del usuario:', error);
      // No lanzamos el error para no interrumpir el registro
    }
  }

  // Login con Google
  async loginWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(this.auth, provider);
      this.currentUser.set(credential.user);
      await this.router.navigate(['/dashboard']);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Cerrar sesión
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.currentUser.set(null);
      await this.router.navigate(['/login']);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Recuperar contraseña
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Verificar si el usuario está autenticado
  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  // Manejo de errores
  private handleError(error: any): string {
    let message = 'Ha ocurrido un error';
    
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'Usuario no encontrado';
        break;
      case 'auth/wrong-password':
        message = 'Contraseña incorrecta';
        break;
      case 'auth/email-already-in-use':
        message = 'El email ya está en uso';
        break;
      case 'auth/weak-password':
        message = 'La contraseña es muy débil';
        break;
      case 'auth/invalid-email':
        message = 'El email no es válido';
        break;
      case 'auth/too-many-requests':
        message = 'Demasiados intentos. Intenta más tarde';
        break;
      case 'auth/popup-closed-by-user':
        message = 'Ventana emergente cerrada';
        break;
      default:
        message = error.message || 'Error en la autenticación';
    }
    
    return message;
  }
}

