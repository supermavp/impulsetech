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
import { Firestore, doc, setDoc, getDoc, docData, updateDoc, collection, getDocs, Timestamp } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, map, switchMap, of } from 'rxjs';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface UserData {
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

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
  
  // Signal para los datos del usuario (incluye rol)
  currentUserData = signal<UserData | null>(null);

  constructor() {
    // Suscribirse a los cambios del usuario
    this.user$.subscribe(async user => {
      this.currentUser.set(user);
      if (user) {
        await this.loadUserData(user.uid);
      } else {
        this.currentUserData.set(null);
      }
    });
  }

  // Login con email y contraseña
  async login(email: string, password: string): Promise<void> {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      this.currentUser.set(credential.user);
      
      // Cargar datos del usuario y redirigir según el rol
      await this.loadUserData(credential.user.uid);
      const userData = this.currentUserData();
      
      if (userData) {
        await this.redirectByRole(userData.role);
      } else {
        await this.router.navigate(['/dashboard']);
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Registro con email y contraseña
  async register(email: string, password: string, role: UserRole, displayName?: string, phone?: string): Promise<void> {
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
          role: role,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await this.loadUserData(credential.user.uid);
      }
      
      this.currentUser.set(credential.user);
      
      // Redirigir según el rol
      await this.redirectByRole(role);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Guardar información del usuario en Firestore
  private async saveUserData(uid: string, userData: UserData): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      // Convertir fechas a Timestamp para Firestore
      const dataToSave = {
        ...userData,
        createdAt: userData.createdAt instanceof Date ? userData.createdAt : new Date(),
        updatedAt: new Date()
      };
      await setDoc(userRef, dataToSave, { merge: true });
    } catch (error) {
      console.error('Error al guardar datos del usuario:', error);
      // No lanzamos el error para no interrumpir el registro
    }
  }
  
  // Cargar datos del usuario desde Firestore
  private async loadUserData(uid: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        const userRole = data['role'] || 'student';
        
        // Si el usuario no tiene rol asignado, actualizarlo en Firestore
        if (!data['role']) {
          await updateDoc(userRef, {
            role: 'student',
            updatedAt: new Date()
          });
        }
        
        this.currentUserData.set({
          email: data['email'],
          displayName: data['displayName'] || '',
          phone: data['phone'],
          role: userRole,
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        });
      } else {
        // Si no existe el documento, crear uno por defecto con rol student
        const user = this.currentUser();
        if (user) {
          await this.saveUserData(uid, {
            email: user.email || '',
            displayName: user.displayName || '',
            role: 'student',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          await this.loadUserData(uid);
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  }
  
  // Obtener rol del usuario actual
  getUserRole(): UserRole | null {
    return this.currentUserData()?.role || null;
  }
  
  // Verificar si el usuario tiene un rol específico
  hasRole(role: UserRole): boolean {
    return this.currentUserData()?.role === role;
  }
  
  // Verificar si el usuario es admin
  isAdmin(): boolean {
    return this.hasRole('admin');
  }
  
  // Verificar si el usuario es teacher
  isTeacher(): boolean {
    return this.hasRole('teacher') || this.isAdmin();
  }
  
  // Verificar si el usuario es student
  isStudent(): boolean {
    return this.hasRole('student');
  }
  
  // Redirigir según el rol del usuario
  private async redirectByRole(role: UserRole): Promise<void> {
    switch (role) {
      case 'admin':
        await this.router.navigate(['/admin']);
        break;
      case 'teacher':
        await this.router.navigate(['/teacher']);
        break;
      case 'student':
        await this.router.navigate(['/student']);
        break;
      default:
        await this.router.navigate(['/dashboard']);
    }
  }
  
  // Obtener datos del usuario como observable
  getUserData$(): Observable<UserData | null> {
    return this.user$.pipe(
      switchMap(user => {
        if (!user) {
          return of(null);
        }
        const userRef = doc(this.firestore, 'users', user.uid);
        return docData(userRef).pipe(
          map(data => {
            if (data) {
              return {
                email: data['email'],
                displayName: data['displayName'] || '',
                phone: data['phone'],
                role: data['role'] || 'student',
                createdAt: data['createdAt']?.toDate() || new Date(),
                updatedAt: data['updatedAt']?.toDate() || new Date()
              } as UserData;
            }
            return null;
          })
        );
      })
    );
  }

  // Login con Google
  async loginWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(this.auth, provider);
      this.currentUser.set(credential.user);
      
      // Verificar si el usuario ya existe en Firestore
      await this.loadUserData(credential.user.uid);
      const userData = this.currentUserData();
      
      if (userData) {
        await this.redirectByRole(userData.role);
      } else {
        // Si es un nuevo usuario con Google, asignar rol student por defecto
        await this.saveUserData(credential.user.uid, {
          email: credential.user.email || '',
          displayName: credential.user.displayName || '',
          role: 'student',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await this.loadUserData(credential.user.uid);
        await this.redirectByRole('student');
      }
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

  // Actualizar rol de un usuario (solo para admins)
  async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    if (!this.isAdmin()) {
      throw new Error('Solo los administradores pueden cambiar roles');
    }

    try {
      const userRef = doc(this.firestore, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error al actualizar rol del usuario:', error);
      throw new Error('Error al actualizar el rol del usuario');
    }
  }

  // Obtener todos los usuarios (solo para admins)
  async getAllUsers(): Promise<Array<{ id: string; email: string; displayName: string; role: UserRole; createdAt: Date }>> {
    if (!this.isAdmin()) {
      throw new Error('Solo los administradores pueden ver todos los usuarios');
    }

    try {
      const usersRef = collection(this.firestore, 'users');
      const usersSnap = await getDocs(usersRef);
      
      return usersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data['email'] || '',
          displayName: data['displayName'] || '',
          role: data['role'] || 'student',
          createdAt: data['createdAt']?.toDate() || new Date()
        };
      });
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw new Error('Error al obtener la lista de usuarios');
    }
  }

  // Migrar usuarios existentes que no tengan rol asignado
  // Esta función solo puede ser ejecutada por un admin
  async migrateUsersWithoutRole(): Promise<{ updated: number; errors: number }> {
    if (!this.isAdmin()) {
      throw new Error('Solo los administradores pueden ejecutar esta migración');
    }

    let updated = 0;
    let errors = 0;

    try {
      const usersRef = collection(this.firestore, 'users');
      const usersSnap = await getDocs(usersRef);

      const updatePromises = usersSnap.docs.map(async (userDoc) => {
        const data = userDoc.data();
        if (!data['role']) {
          try {
            await updateDoc(doc(this.firestore, 'users', userDoc.id), {
              role: 'student',
              updatedAt: Timestamp.now()
            });
            updated++;
          } catch (error) {
            console.error(`Error al actualizar usuario ${userDoc.id}:`, error);
            errors++;
          }
        }
      });

      await Promise.all(updatePromises);
      return { updated, errors };
    } catch (error) {
      console.error('Error en la migración de usuarios:', error);
      throw error;
    }
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

